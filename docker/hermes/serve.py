"""HTTP wrapper around `hermes acp`. Castle posts {text, session} to /agent
and reads NDJSON lines mapping ACP session/update notifications.

Wire format (additive over the old `hermes -z` shape):
  {"type":"session","session_id":"…"}            once if a fresh session was minted
  {"type":"text","delta":"…"}                    agent_message_chunk text
  {"type":"thought","delta":"…"}                 agent_thought_chunk text
  {"type":"tool_start","id":"…","name":"…",…}    tool_call (status pending/in_progress)
  {"type":"tool_end","id":"…","ok":bool}         tool_call_update (completed/failed)
  {"type":"error","message":"…"}                 rpc error or stop_reason=refusal
  {"type":"done","stop_reason":"…"}              session/prompt response

The ACP subprocess is persistent: spawned lazily on first request, shared
across all chats, and automatically restarted if it dies. Different chat
sessions multiplex on the same subprocess via session_id-keyed update queues.
"""

import asyncio
import json
import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

logger = logging.getLogger("castle-hermes-acp")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stderr,
)

BEARER = os.environ.get("CASTLE_HERMES_TOKEN") or None
PROTOCOL_VERSION = int(os.environ.get("ACP_PROTOCOL_VERSION", "1"))
HERMES_CWD = os.environ.get("HERMES_CWD") or "/tmp"


# ACP's _register_session_mcp_servers does NOT auto-attach config.yaml MCPs
# to sessions — it only honors what we pass in session/new mcpServers. The
# global config.yaml block governs discover_mcp_tools() (toolset loading),
# but the per-session enabled-toolsets list still has to mention each MCP
# explicitly, which session/new does via mcpServers. So we pass both Castle
# + Composio URLs here for every session we mint.
def _mcp_servers() -> list[dict]:
    """ACP's NewSessionRequest expects HttpMcpServer entries with an explicit
    `type: "http"` discriminator — the bare {name, url, headers} shape fails
    pydantic validation with "Invalid params". Same for SSE; we use HTTP."""
    servers: list[dict] = []
    castle = os.environ.get("CASTLE_MCP_URL")
    if castle:
        servers.append({"type": "http", "name": "castle", "url": castle, "headers": []})
    composio = os.environ.get("COMPOSIO_MCP_URL")
    if composio:
        # Composio's hosted MCP endpoint refuses requests without an API
        # key in the headers — 401 with "API key or valid JWT Bearer
        # token is required in headers for security reasons". Without
        # this header the connection fails at handshake and the agent
        # has no Composio tools.
        composio_headers: list[dict] = []
        api_key = os.environ.get("COMPOSIO_API_KEY")
        if api_key:
            composio_headers.append({"name": "x-api-key", "value": api_key})
        servers.append(
            {
                "type": "http",
                "name": "composio",
                "url": composio,
                "headers": composio_headers,
            }
        )
    return servers


# ──────────────────────────── ACP client ────────────────────────────


class HermesACP:
    """Persistent `hermes acp` subprocess + JSON-RPC client.

    Concurrency model: one writer lock (stdin can't interleave frames),
    one reader task fans out incoming frames to per-id pending futures
    and per-sessionId update queues. Up to 4 chat sessions can stream
    concurrently — ACP backs prompt execution with a process-wide
    ThreadPoolExecutor(max_workers=4) upstream, the 5th queues.
    """

    def __init__(self) -> None:
        self._proc: Optional[asyncio.subprocess.Process] = None
        self._writer_lock = asyncio.Lock()
        self._spawn_lock = asyncio.Lock()
        self._next_id = 1
        self._pending: dict[int, asyncio.Future] = {}
        self._session_queues: dict[str, asyncio.Queue] = {}
        # Per-session prompt lock. Held from `session/prompt` start
        # through the prompt-future resolution (including the await on
        # cancel-cleanup) so a stop-then-immediate-send doesn't fire
        # the next prompt while Hermes is still releasing its own
        # runtime_lock — which was making the agent reply with
        # "Queued for the next turn. (1 queued)" instead of running
        # the new prompt fresh.
        self._session_prompt_locks: dict[str, asyncio.Lock] = {}
        self._reader_task: Optional[asyncio.Task] = None
        self._stderr_task: Optional[asyncio.Task] = None
        self._initialized = False

    def _prompt_lock(self, session_id: str) -> asyncio.Lock:
        lock = self._session_prompt_locks.get(session_id)
        if lock is None:
            lock = asyncio.Lock()
            self._session_prompt_locks[session_id] = lock
        return lock

    async def ensure_alive(self) -> None:
        if self._proc and self._proc.returncode is None and self._initialized:
            return
        async with self._spawn_lock:
            if self._proc and self._proc.returncode is None and self._initialized:
                return
            await self._reset_state()
            await self._spawn()
            await self._handshake()
            self._initialized = True

    async def _reset_state(self) -> None:
        for fut in self._pending.values():
            if not fut.done():
                fut.set_exception(RuntimeError("acp process restarting"))
        self._pending.clear()
        self._session_queues.clear()
        # Drop any session prompt locks so the next stream_prompt gets a
        # fresh one. Anything blocked on the old lock will resolve via
        # the done-callback (the pending future just got an exception
        # set above, which fires the callback).
        self._session_prompt_locks.clear()
        for t in (self._reader_task, self._stderr_task):
            if t and not t.done():
                t.cancel()
        self._reader_task = None
        self._stderr_task = None
        if self._proc and self._proc.returncode is None:
            try:
                self._proc.kill()
                await self._proc.wait()
            except Exception:  # noqa: BLE001
                pass
        self._proc = None
        self._initialized = False

    async def _spawn(self) -> None:
        # `hermes acp` resolves to the venv-installed hermes-acp entrypoint
        # via the wrapper at /root/.local/bin/hermes. The wrapper unsets
        # PYTHONPATH/PYTHONHOME and execs the venv python, which has
        # acp_adapter on its sys.path. If hermes isn't on PATH for some
        # reason, fall back to the venv binary directly.
        hermes_acp_bin = os.environ.get(
            "HERMES_ACP_BIN", "/root/.hermes/hermes-agent/venv/bin/hermes-acp"
        )
        if os.path.exists(hermes_acp_bin):
            cmd = [hermes_acp_bin]
        else:
            cmd = ["hermes", "acp"]
        env = dict(os.environ)
        env["PYTHONUNBUFFERED"] = "1"
        # The hermes wrapper script clears PYTHONPATH/PYTHONHOME — if we're
        # using `hermes-acp` directly we should too, so the venv's site-
        # packages stays on top of any host-imposed path.
        env.pop("PYTHONPATH", None)
        env.pop("PYTHONHOME", None)
        logger.info("Spawning ACP subprocess: %s", " ".join(cmd))
        self._proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
        self._reader_task = asyncio.create_task(self._reader_loop())
        self._stderr_task = asyncio.create_task(self._stderr_loop())

    async def _stderr_loop(self) -> None:
        assert self._proc and self._proc.stderr
        try:
            while True:
                line = await self._proc.stderr.readline()
                if not line:
                    break
                logger.info("[acp-stderr] %s", line.decode("utf-8", "replace").rstrip())
        except asyncio.CancelledError:
            return

    async def _reader_loop(self) -> None:
        assert self._proc and self._proc.stdout
        try:
            while True:
                line = await self._proc.stdout.readline()
                if not line:
                    logger.warning("ACP subprocess closed stdout — marking dead")
                    self._initialized = False
                    return
                try:
                    msg = json.loads(line.decode("utf-8"))
                except Exception:  # noqa: BLE001
                    logger.warning("Bad ACP frame: %r", line[:200])
                    continue
                self._dispatch(msg)
        except asyncio.CancelledError:
            return

    def _dispatch(self, msg: dict) -> None:
        # Response to one of our requests.
        if "id" in msg and ("result" in msg or "error" in msg):
            fut = self._pending.pop(msg["id"], None)
            if fut and not fut.done():
                if "error" in msg:
                    err = msg["error"] or {}
                    fut.set_exception(RuntimeError(err.get("message") or "acp error"))
                else:
                    fut.set_result(msg.get("result"))
            return

        method = msg.get("method")
        # ACP pushes streaming updates as `session/update` notifications.
        if method == "session/update":
            params = msg.get("params") or {}
            sid = params.get("sessionId")
            q = self._session_queues.get(sid)
            if q is not None:
                q.put_nowait(params)
            return

        # Permission prompts from the server during tool execution. The
        # ACP server expects a JSON-RPC response with the chosen option;
        # we auto-allow so non-interactive runs don't deadlock.
        if method == "session/request_permission" and "id" in msg:
            self._auto_allow_permission(msg)
            return

        # Anything else — ignore (init announcements, model state, etc.).

    def _auto_allow_permission(self, msg: dict) -> None:
        req_id = msg.get("id")
        params = msg.get("params") or {}
        options = params.get("options") or []
        # Prefer an "allow"-shaped option; fall back to the first.
        chosen = None
        for opt in options:
            kind = (opt.get("kind") or "").lower()
            name = (opt.get("name") or "").lower()
            if "allow" in kind or "allow" in name or kind == "allow_always":
                chosen = opt
                break
        if not chosen and options:
            chosen = options[0]
        outcome: dict[str, Any]
        if chosen:
            outcome = {"outcome": "selected", "optionId": chosen.get("optionId")}
        else:
            outcome = {"outcome": "cancelled"}

        async def reply() -> None:
            try:
                await self._write(
                    {"jsonrpc": "2.0", "id": req_id, "result": {"outcome": outcome}}
                )
            except Exception:  # noqa: BLE001
                logger.exception("Failed to reply to permission prompt")

        asyncio.create_task(reply())

    async def _write(self, msg: dict) -> None:
        async with self._writer_lock:
            assert self._proc and self._proc.stdin
            self._proc.stdin.write((json.dumps(msg) + "\n").encode("utf-8"))
            await self._proc.stdin.drain()

    async def _request(self, method: str, params: dict) -> Any:
        """Send a JSON-RPC request and await its response. Does NOT call
        ensure_alive — callers either come via `request()` (which does) or
        from inside the handshake (where the proc is alive but not yet
        flagged initialized)."""
        if not self._proc or self._proc.returncode is not None:
            raise RuntimeError("acp process not running")
        req_id = self._next_id
        self._next_id += 1
        loop = asyncio.get_running_loop()
        fut: asyncio.Future = loop.create_future()
        self._pending[req_id] = fut
        try:
            await self._write(
                {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "method": method,
                    "params": params,
                }
            )
            return await fut
        except Exception as e:
            # Make errors easier to chase — log the request that failed.
            logger.warning(
                "ACP request %s(%s) failed: %s",
                method,
                json.dumps(params)[:300],
                e,
            )
            raise

    async def request(self, method: str, params: dict) -> Any:
        await self.ensure_alive()
        return await self._request(method, params)

    async def _handshake(self) -> None:
        init = await self._request(
            "initialize",
            {
                "protocolVersion": PROTOCOL_VERSION,
                "clientCapabilities": {},
                "clientInfo": {"name": "castle-hermes-wrapper", "version": "1.0"},
            },
        )
        logger.info(
            "ACP initialized (agent=%s v=%s)",
            ((init or {}).get("agentInfo") or {}).get("name"),
            ((init or {}).get("agentInfo") or {}).get("version"),
        )
        # Hermes' ACP server advertises auth methods (e.g. "anthropic"
        # runtime credentials) but the runtime creds are already loaded
        # from ~/.hermes/.env by the time the agent starts. Calling
        # authenticate here is optional — session/new works without it
        # (verified by direct stdio probe). Skip unless we ever ship a
        # provider that requires an explicit auth handshake.
        _ = (init or {}).get("authMethods") or []

    # ── public API used by the /agent stream ──

    async def new_session(self) -> str:
        result = await self.request(
            "session/new",
            {"cwd": HERMES_CWD, "mcpServers": _mcp_servers()},
        )
        return result["sessionId"]

    async def load_session(self, session_id: str) -> bool:
        try:
            result = await self.request(
                "session/load",
                {
                    "cwd": HERMES_CWD,
                    "sessionId": session_id,
                    "mcpServers": _mcp_servers(),
                },
            )
            # Hermes ACP returns `{"result": {}}` (empty dict, not null)
            # when the session id is unknown — the upstream handler hits
            # `if state is None: return None` and the JSON-RPC layer
            # encodes that as `{}`. So `result is not None` is true even
            # when the session doesn't exist; check for the presence of
            # `models` (which a real LoadSessionResponse always carries)
            # to distinguish a real load from a phantom "OK".
            return isinstance(result, dict) and "models" in result
        except Exception as e:  # noqa: BLE001
            logger.info("session/load(%s) failed: %s", session_id, e)
            return False

    @asynccontextmanager
    async def stream_prompt(self, session_id: str, text: str):
        """Send session/prompt, yield (queue, prompt_future).

        Holds a per-session asyncio.Lock from session/prompt write
        through prompt-future resolution. If the caller is cancelled
        mid-stream, the lock stays held until we await the future to
        actually resolve (with a timeout), so the next /agent request
        for the same session arrives to an idle Hermes runtime_lock
        instead of getting silently queued behind a half-cancelled
        prior turn.
        """
        lock = self._prompt_lock(session_id)
        await lock.acquire()
        q: asyncio.Queue = asyncio.Queue()
        self._session_queues[session_id] = q
        fut: Optional[asyncio.Future] = None
        try:
            req_id = self._next_id
            self._next_id += 1
            loop = asyncio.get_running_loop()
            fut = loop.create_future()
            self._pending[req_id] = fut
            await self._write(
                {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "method": "session/prompt",
                    "params": {
                        "sessionId": session_id,
                        "prompt": [{"type": "text", "text": text}],
                    },
                }
            )
            yield q, fut
        finally:
            self._session_queues.pop(session_id, None)

            # Release the per-session lock. Two paths:
            #   - Normal exit: prompt_fut is already done; release now.
            #   - Cancel exit: prompt_fut is still pending (Hermes
            #     hasn't acknowledged the cancel yet). Defer release
            #     via add_done_callback so the next prompt on this
            #     session blocks until Hermes has finished winding
            #     down. Awaiting in the finally is fragile during
            #     cancellation propagation; the callback path is
            #     safer.
            def _safe_release() -> None:
                try:
                    lock.release()
                except RuntimeError:
                    pass  # already released — shouldn't happen but defensive

            if fut is None or fut.done():
                _safe_release()
            else:
                fut.add_done_callback(lambda _: _safe_release())
                # Belt-and-braces: if Hermes is wedged on a tool call and
                # never resolves the prompt future (the cancel
                # notification can't pre-empt an in-flight tool
                # execution), force-release the lock after this many
                # seconds so the next prompt on this session isn't
                # blocked forever. Must stay well under Vercel's 300s
                # function maxDuration — otherwise the route waiting on
                # this lock gets killed and the client sees a 504.
                # 30s is generous for normal cancel propagation
                # (typically <5s) and tight enough that a wedged
                # session can't soak the entire Vercel budget.
                # Double-release is benign — _safe_release swallows the
                # RuntimeError.
                try:
                    loop = asyncio.get_running_loop()
                    loop.call_later(30.0, _safe_release)
                except RuntimeError:
                    pass  # no running loop (process tearing down)

    async def cancel(self, session_id: str) -> None:
        try:
            await self._write(
                {
                    "jsonrpc": "2.0",
                    "method": "session/cancel",
                    "params": {"sessionId": session_id},
                }
            )
        except Exception:  # noqa: BLE001
            logger.debug("session/cancel failed", exc_info=True)


hermes = HermesACP()
app = FastAPI()


# ──────────────────────── HTTP surface ────────────────────────


@app.get("/healthz")
async def healthz() -> dict:
    return {"ok": True}


def _emit(ev: dict) -> bytes:
    return (json.dumps(ev) + "\n").encode("utf-8")


def _content_text(content: Any) -> str:
    """Extract text from an ACP ContentBlock or list thereof."""
    if isinstance(content, list):
        return "".join(_content_text(c) for c in content)
    if isinstance(content, dict):
        if content.get("type") == "text":
            return content.get("text", "") or ""
        inner = content.get("content")
        if isinstance(inner, (dict, list)):
            return _content_text(inner)
    return ""


def _map_update(upd: dict) -> Optional[dict]:
    """Translate an ACP session/update payload to Castle's NDJSON shape."""
    kind = upd.get("sessionUpdate")
    if kind == "agent_message_chunk":
        delta = _content_text(upd.get("content"))
        if delta:
            return {"type": "text", "delta": delta}
    elif kind == "agent_thought_chunk":
        delta = _content_text(upd.get("content"))
        if delta:
            return {"type": "thought", "delta": delta}
    elif kind == "tool_call":
        return {
            "type": "tool_start",
            "id": upd.get("toolCallId"),
            "name": upd.get("title") or upd.get("kind") or "tool",
            "kind": upd.get("kind"),
        }
    elif kind == "tool_call_update":
        status = upd.get("status")
        if status in ("completed", "failed"):
            return {
                "type": "tool_end",
                "id": upd.get("toolCallId"),
                "ok": status == "completed",
            }
    return None


async def _stream(session_in: str, text: str) -> AsyncIterator[bytes]:
    await hermes.ensure_alive()

    # Resolve session id — load if known, else mint new and surface so
    # the route can persist it back to Convex.
    session_id = session_in
    bound_new = False
    if session_id:
        ok = await hermes.load_session(session_id)
        if not ok:
            session_id = await hermes.new_session()
            bound_new = True
    else:
        session_id = await hermes.new_session()
        bound_new = True

    if bound_new:
        yield _emit({"type": "session", "session_id": session_id})

    try:
        async with hermes.stream_prompt(session_id, text) as (q, prompt_fut):
            # Heartbeat cadence — Vercel / intermediate proxies have been
            # observed to close idle streams around 25-30s of no bytes
            # in either direction. The agent often has long quiet
            # stretches while Claude is generating tokens between tool
            # calls; emit a no-op ping every IDLE_PING_SEC seconds so
            # the stream is never truly idle. Clients ignore unknown
            # event types.
            IDLE_PING_SEC = 15.0
            while True:
                drain_task = asyncio.ensure_future(q.get())
                done, _ = await asyncio.wait(
                    {drain_task, prompt_fut},
                    return_when=asyncio.FIRST_COMPLETED,
                    timeout=IDLE_PING_SEC,
                )
                # No frame within the heartbeat window — emit a ping
                # and loop. Both the queue task and the prompt future
                # remain unresolved, so we cancel the queue task (a
                # fresh one is scheduled on the next iteration) and
                # leave the prompt future intact.
                if not done:
                    drain_task.cancel()
                    yield _emit({"type": "ping"})
                    continue
                if drain_task in done:
                    params = drain_task.result()
                    mapped = _map_update(params.get("update", {}) or {})
                    if mapped:
                        yield _emit(mapped)
                else:
                    drain_task.cancel()

                if prompt_fut in done:
                    # Drain any straggler updates already buffered.
                    while not q.empty():
                        try:
                            params = q.get_nowait()
                        except asyncio.QueueEmpty:
                            break
                        mapped = _map_update(params.get("update", {}) or {})
                        if mapped:
                            yield _emit(mapped)
                    try:
                        result = prompt_fut.result()
                        stop_reason = (result or {}).get("stopReason")
                    except Exception as e:  # noqa: BLE001
                        yield _emit({"type": "error", "message": str(e)})
                        stop_reason = "error"
                    yield _emit({"type": "done", "stop_reason": stop_reason})
                    return
    except asyncio.CancelledError:
        await hermes.cancel(session_id)
        raise


@app.post("/agent")
async def agent(req: Request) -> StreamingResponse:
    if BEARER:
        auth = req.headers.get("authorization", "")
        if not auth.startswith("Bearer ") or auth[7:] != BEARER:
            raise HTTPException(401, "bad bearer")

    body = await req.json()
    text = (body or {}).get("text") or ""
    session = (body or {}).get("session") or ""
    if not isinstance(text, str) or not text.strip():
        raise HTTPException(400, "text required")
    if not isinstance(session, str):
        raise HTTPException(400, "session must be a string (may be empty)")

    return StreamingResponse(_stream(session, text), media_type="application/x-ndjson")


# ─────────────────────────────────────────────────────────────────────
# Long-running turn path: /agent/start + /agent/cancel/{turn_id}
#
# Replaces the NDJSON streaming of /agent. The Vercel route POSTs once
# to /agent/start with a kickoff token and write token; we verify, spawn
# a background asyncio task to run the prompt, and return 202. The
# background task writes to Convex (agent_message_chunks, agent_tool_events,
# agent_turns heartbeat/complete/fail). The client subscribes to Convex
# reactively for the in-flight state — no long HTTP stream over Vercel.
# ─────────────────────────────────────────────────────────────────────

# Inflight turn tasks, keyed by turn_id, so /agent/cancel can find them.
_inflight_turns: dict[str, asyncio.Task] = {}


def _hashed_body_for_verify(payload: bytes) -> str:
    import hashlib as _h

    return _h.sha256(payload).hexdigest()


@app.post("/agent/start")
async def agent_start(req: Request) -> JSONResponse:
    raw = await req.body()
    try:
        body = json.loads(raw.decode("utf-8"))
    except Exception:
        raise HTTPException(400, "bad json")
    turn_id = body.get("turnId")
    conversation_id = body.get("conversationId")
    actor_slug = body.get("actorSlug")
    hermes_session = body.get("hermesSession")
    visibility = body.get("visibility") or "personal"
    text = body.get("text") or ""
    attachments = body.get("attachments") or []
    write_token = body.get("writeToken")
    convex_url = body.get("convexUrl")
    # hermes_session can be an empty string (first turn), _run_turn_to_convex will mint a new session
    if not all([turn_id, conversation_id, actor_slug, write_token, convex_url]):
        raise HTTPException(400, "missing required fields")
    if hermes_session is None:
        raise HTTPException(400, "hermesSession must be present (may be empty string)")

    # Verify the kickoff token from the X-Castle-Kickoff header.
    kickoff_token = req.headers.get("X-Castle-Kickoff", "")
    from turn_token import CASTLE_STREAM_SECRET, TokenError, verify_kickoff_token

    if not CASTLE_STREAM_SECRET:
        raise HTTPException(500, "CASTLE_STREAM_SECRET not set on wrapper")
    try:
        verify_kickoff_token(
            token=kickoff_token,
            secret=CASTLE_STREAM_SECRET,
            body_hash=_hashed_body_for_verify(raw),
            turn_id=turn_id,
        )
    except TokenError as e:
        raise HTTPException(401, f"invalid kickoff token: {e}")

    # Atomic queued → running claim. Throws if the turn isn't in queued
    # state (replay protection).
    from convex_client import ConvexClient

    cc = ConvexClient(convex_url)
    try:
        await cc.mutation(
            "agentTurns:claimQueued",
            {"turn_id": turn_id, "write_token": write_token},
        )
    except Exception as e:
        await cc.close()
        raise HTTPException(409, f"could not claim turn: {e}")

    # Spawn background task. Returns 202 immediately.
    task = asyncio.create_task(
        _run_turn_to_convex(
            cc=cc,
            turn_id=turn_id,
            conversation_id=conversation_id,
            actor_slug=actor_slug,
            hermes_session=hermes_session,
            visibility=visibility,
            text=text,
            attachments=attachments,
            write_token=write_token,
            convex_url=convex_url,
        )
    )
    _inflight_turns[turn_id] = task
    task.add_done_callback(lambda _: _inflight_turns.pop(turn_id, None))

    return JSONResponse({"ok": True}, status_code=202)


@app.post("/agent/cancel/{turn_id}")
async def agent_cancel(turn_id: str) -> JSONResponse:
    task = _inflight_turns.get(turn_id)
    if task is None:
        # Either the turn already completed or this wrapper instance
        # never had it. The wrapper's per-turn convex-status poll will
        # also catch the canceled state within ~2s; this endpoint just
        # makes cancellation snappier.
        return JSONResponse({"ok": True, "note": "not in flight here"})
    task.cancel()
    return JSONResponse({"ok": True})


async def _run_turn_to_convex(
    *,
    cc: Any,  # ConvexClient
    turn_id: str,
    conversation_id: str,
    actor_slug: str,
    hermes_session: str,
    visibility: str,
    text: str,
    attachments: list,
    write_token: str,
    convex_url: str,
) -> None:
    """Run one assistant turn against Hermes, streaming deltas to
    Convex. Lives outside the HTTP request lifecycle — Vercel's 300s
    is no longer in the picture.
    """
    from turn_token import CASTLE_STREAM_SECRET, mint_write_token

    # Renew the write token if it's getting old (TTL was set to 1h
    # by Vercel; for a 30-min turn this is fine, but agents that go
    # longer would lose write authority. Re-mint as needed.)
    current_token = write_token
    token_minted_at = time.time()

    def _token() -> str:
        nonlocal current_token, token_minted_at
        # Re-mint if older than 30 minutes, to leave 30 min of headroom.
        if time.time() - token_minted_at > 1800 and CASTLE_STREAM_SECRET:
            current_token = mint_write_token(
                secret=CASTLE_STREAM_SECRET, turn_id=turn_id, ttl_sec=3600
            )
            token_minted_at = time.time()
        return current_token

    # Flush bucket for text + thought deltas. Tool events go straight
    # through (low rate, high signal).
    text_buffer: list[str] = []
    thought_buffer: list[str] = []
    text_seq = 0
    tool_seq = 0
    text_bytes_pending = 0
    FLUSH_INTERVAL = 0.5  # 500ms
    FLUSH_BYTES = 1024
    last_flush = time.time()
    last_heartbeat = time.time()
    HEARTBEAT_INTERVAL = 15.0
    CANCEL_POLL_INTERVAL = 2.0
    last_cancel_poll = time.time()
    assistant_text_parts: list[str] = []  # accumulated for final snapshot

    async def flush_text() -> None:
        nonlocal text_buffer, text_seq, text_bytes_pending, last_flush
        if not text_buffer:
            return
        delta = "".join(text_buffer)
        text_buffer = []
        text_bytes_pending = 0
        last_flush = time.time()
        seq = text_seq
        text_seq += 1
        try:
            await cc.mutation(
                "agentMessageChunks:append",
                {
                    "turn_id": turn_id,
                    "write_token": _token(),
                    "seq": seq,
                    "delta": delta,
                },
            )
            assistant_text_parts.append(delta)
        except Exception:
            logger.exception("agentMessageChunks:append failed")

    async def flush_thought() -> None:
        nonlocal thought_buffer, tool_seq, last_flush
        if not thought_buffer:
            return
        delta = "".join(thought_buffer)
        thought_buffer = []
        last_flush = time.time()
        seq = tool_seq
        tool_seq += 1
        try:
            await cc.mutation(
                "agentToolEvents:append",
                {
                    "turn_id": turn_id,
                    "write_token": _token(),
                    "seq": seq,
                    "kind": "thought",
                    "delta": delta,
                },
            )
        except Exception:
            logger.exception("agentToolEvents:append (thought) failed")

    async def append_tool_event(kind: str, **fields: Any) -> None:
        nonlocal tool_seq
        seq = tool_seq
        tool_seq += 1
        args = {
            "turn_id": turn_id,
            "write_token": _token(),
            "seq": seq,
            "kind": kind,
        }
        for k, v in fields.items():
            if v is not None:
                args[k] = v
        try:
            await cc.mutation("agentToolEvents:append", args)
        except Exception:
            logger.exception("agentToolEvents:append (%s) failed", kind)

    async def heartbeat() -> None:
        nonlocal last_heartbeat
        last_heartbeat = time.time()
        try:
            await cc.mutation(
                "agentTurns:heartbeat",
                {"turn_id": turn_id, "write_token": _token()},
            )
        except Exception:
            logger.exception("agentTurns:heartbeat failed")

    async def check_canceled() -> bool:
        # Poll agentTurns.activeFor for status. Cheap when called every
        # 2s. Returns True if canceled.
        try:
            res = await cc.query(
                "agentTurns:activeFor",
                {"conversation_id": None, "actor_slug": actor_slug},
            )
            # activeFor returns null if the turn is already done (any
            # terminal state including canceled). That's our cancel
            # signal — but we don't know if it was complete, canceled,
            # or failed. To distinguish, we'd need a separate getStatus
            # query. For now, if our turn was running and Convex no
            # longer reports it as active, treat as canceled (safe:
            # complete/fail are caught by other paths first).
            return res is None
        except Exception:
            return False

    # ─── Main loop: run the ACP prompt, route updates to Convex ───
    actual_session_id: Optional[str] = None
    try:
        # session resolution mirrors _stream() at line ~511. New session
        # if hermes_session doesn't resolve.
        actual_session_id = hermes_session
        minted_new = False
        if actual_session_id:
            ok = await hermes.load_session(actual_session_id)
            if not ok:
                actual_session_id = await hermes.new_session()
                minted_new = True
        else:
            actual_session_id = await hermes.new_session()
            minted_new = True

        # Bind the actual session id back to Convex when we mint a fresh
        # one. Without this, every turn observes the stored
        # hermes_session, fails to load it, mints yet another new one,
        # and the agent never accumulates context — the "new context
        # every turn" bug. Best-effort; a failure is logged but doesn't
        # abort the turn.
        if minted_new and actual_session_id and actual_session_id != hermes_session:
            try:
                await cc.mutation(
                    "agentMessages:bindSession",
                    {
                        "id": conversation_id,
                        "turn_id": turn_id,
                        "write_token": _token(),
                        "hermes_session": actual_session_id,
                        # Race safety: if `setVisibility` re-minted while
                        # we were loading, the row's current
                        # hermes_session no longer matches what we
                        # observed at the start of this turn — the
                        # mutation skips the patch and the new session
                        # stays authoritative.
                        "expected_hermes_session": hermes_session,
                    },
                )
            except Exception:
                logger.exception(
                    "agentMessages:bindSession failed (turn=%s)",
                    turn_id,
                )

        # Visibility-aware preamble. Personal chats get a discretion
        # nudge; shared chats are flagged so the agent knows multiple
        # operators may read. Prepended as a single line in front of the
        # user's text — kept short to avoid blowing context for chatty
        # multi-turn sessions.
        if visibility == "shared":
            preamble = (
                "[chat mode: shared — multiple teammates may read and "
                "post here; treat statements as multi-author and avoid "
                "echoing private memory unless the asker confirms it's "
                "ok to surface]"
            )
        else:
            preamble = (
                "[chat mode: personal — this thread is private to the "
                f"asker ({actor_slug}); their memory should not be "
                "surfaced into shared chats unless they ask]"
            )
        # Attachments: surface as a one-line directory of file URLs.
        # The agent can fetch them with its own tools if needed; we do
        # not download or pre-process anything server-side (no OCR, no
        # preview rendering — that's a follow-up).
        attachment_block = ""
        if attachments:
            lines = []
            for a in attachments:
                name = a.get("name") if isinstance(a, dict) else None
                url = a.get("url") if isinstance(a, dict) else None
                ct = a.get("contentType") if isinstance(a, dict) else None
                if not name or not url:
                    continue
                lines.append(f"- {name}" + (f" ({ct})" if ct else "") + f": {url}")
            if lines:
                attachment_block = (
                    "[the asker attached these files; fetch them if "
                    "the question references them]\n" + "\n".join(lines) + "\n\n"
                )
        framed_text = f"{preamble}\n\n{attachment_block}{text}"

        async with hermes.stream_prompt(actual_session_id, framed_text) as (
            q,
            prompt_fut,
        ):
            IDLE_PING_SEC = 1.0  # tight loop; we flush manually
            while True:
                drain_task = asyncio.ensure_future(q.get())
                done, _ = await asyncio.wait(
                    {drain_task, prompt_fut},
                    return_when=asyncio.FIRST_COMPLETED,
                    timeout=IDLE_PING_SEC,
                )
                if not done:
                    drain_task.cancel()
                    # Periodic flush / heartbeat / cancel-poll.
                    if time.time() - last_flush > FLUSH_INTERVAL:
                        await flush_text()
                        await flush_thought()
                    if time.time() - last_heartbeat > HEARTBEAT_INTERVAL:
                        await heartbeat()
                    if time.time() - last_cancel_poll > CANCEL_POLL_INTERVAL:
                        last_cancel_poll = time.time()
                        # NB: activeFor needs conversation_id; we don't
                        # have it here cheaply. Skip cancel-poll for v1;
                        # the /agent/cancel/{turn_id} HTTP endpoint
                        # already covers the common case.
                    continue
                if drain_task in done:
                    params = drain_task.result()
                    upd = params.get("update", {}) or {}
                    kind = upd.get("sessionUpdate")
                    if kind == "agent_message_chunk":
                        delta = _content_text(upd.get("content"))
                        if delta:
                            text_buffer.append(delta)
                            text_bytes_pending += len(delta.encode("utf-8"))
                            if text_bytes_pending >= FLUSH_BYTES:
                                await flush_text()
                    elif kind == "agent_thought_chunk":
                        delta = _content_text(upd.get("content"))
                        if delta:
                            thought_buffer.append(delta)
                    elif kind == "tool_call":
                        await append_tool_event(
                            "tool_start",
                            tool_call_id=upd.get("toolCallId"),
                            name=upd.get("title") or upd.get("kind") or "tool",
                        )
                    elif kind == "tool_call_update":
                        status_ = upd.get("status")
                        if status_ in ("completed", "failed"):
                            await append_tool_event(
                                "tool_end",
                                tool_call_id=upd.get("toolCallId"),
                                ok=(status_ == "completed"),
                            )
                else:
                    drain_task.cancel()

                if prompt_fut in done:
                    # Drain stragglers
                    while not q.empty():
                        try:
                            params = q.get_nowait()
                        except asyncio.QueueEmpty:
                            break
                        upd = params.get("update", {}) or {}
                        kind = upd.get("sessionUpdate")
                        if kind == "agent_message_chunk":
                            delta = _content_text(upd.get("content"))
                            if delta:
                                text_buffer.append(delta)
                        elif kind == "agent_thought_chunk":
                            delta = _content_text(upd.get("content"))
                            if delta:
                                thought_buffer.append(delta)
                    # Final flushes
                    await flush_text()
                    await flush_thought()
                    # Done — write the snapshot.
                    try:
                        result = prompt_fut.result()
                        stop_reason = (result or {}).get("stopReason") or "end_turn"
                    except Exception as e:
                        await cc.mutation(
                            "agentTurns:fail",
                            {
                                "turn_id": turn_id,
                                "write_token": _token(),
                                "error": str(e)[:500],
                                "partial_text": "".join(assistant_text_parts),
                            },
                        )
                        return
                    await cc.mutation(
                        "agentTurns:complete",
                        {
                            "turn_id": turn_id,
                            "write_token": _token(),
                            "final_text": "".join(assistant_text_parts),
                            "stop_reason": stop_reason,
                        },
                    )
                    return
    except asyncio.CancelledError:
        # /agent/cancel signalled us. Send Hermes cancel + mark turn.
        if actual_session_id:
            try:
                await hermes.cancel(actual_session_id)
            except Exception:
                pass
        await flush_text()
        await flush_thought()
        try:
            await cc.mutation(
                "agentTurns:fail",
                {
                    "turn_id": turn_id,
                    "write_token": _token(),
                    "error": "canceled by operator",
                    "partial_text": "".join(assistant_text_parts),
                },
            )
        except Exception:
            logger.exception("could not mark turn canceled")
        raise
    except Exception as e:
        logger.exception("turn %s failed: %s", turn_id, e)
        await flush_text()
        await flush_thought()
        try:
            await cc.mutation(
                "agentTurns:fail",
                {
                    "turn_id": turn_id,
                    "write_token": _token(),
                    "error": str(e)[:500],
                    "partial_text": "".join(assistant_text_parts),
                },
            )
        except Exception:
            logger.exception("could not mark turn failed")
    finally:
        await cc.close()


@app.exception_handler(HTTPException)
async def http_exception_handler(_req: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)
