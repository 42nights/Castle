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
        servers.append(
            {"type": "http", "name": "castle", "url": castle, "headers": []}
        )
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
        self._reader_task: Optional[asyncio.Task] = None
        self._stderr_task: Optional[asyncio.Task] = None
        self._initialized = False

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
                logger.info(
                    "[acp-stderr] %s", line.decode("utf-8", "replace").rstrip()
                )
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
                    fut.set_exception(
                        RuntimeError(err.get("message") or "acp error")
                    )
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
        options = (params.get("options") or [])
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
            return result is not None
        except Exception as e:  # noqa: BLE001
            logger.info("session/load(%s) failed: %s", session_id, e)
            return False

    @asynccontextmanager
    async def stream_prompt(self, session_id: str, text: str):
        """Send session/prompt, yield (queue, prompt_future)."""
        q: asyncio.Queue = asyncio.Queue()
        self._session_queues[session_id] = q
        try:
            req_id = self._next_id
            self._next_id += 1
            loop = asyncio.get_running_loop()
            fut: asyncio.Future = loop.create_future()
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
            while True:
                drain_task = asyncio.ensure_future(q.get())
                done, _ = await asyncio.wait(
                    {drain_task, prompt_fut},
                    return_when=asyncio.FIRST_COMPLETED,
                )
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

    return StreamingResponse(
        _stream(session, text), media_type="application/x-ndjson"
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(_req: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)
