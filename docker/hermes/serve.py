"""HTTP wrapper around `hermes -z`. Castle on Vercel posts {text, session}
to /agent and reads NDJSON lines: {type:"text",delta:...} ... {type:"done"}.

Same wire protocol Castle's local /api/agent already speaks, so the
client (lib/use-hermes-chat.ts) doesn't have to change.
"""

import asyncio
import json
import os
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

app = FastAPI()

BEARER = os.environ.get("CASTLE_HERMES_TOKEN") or None
MODEL = os.environ.get("HERMES_MODEL", "claude-opus-4-7")
PROVIDER = os.environ.get("HERMES_PROVIDER", "anthropic")


@app.get("/healthz")
async def healthz():
    return {"ok": True}


@app.post("/agent")
async def agent(req: Request):
    if BEARER:
        auth = req.headers.get("authorization", "")
        if not auth.startswith("Bearer ") or auth[7:] != BEARER:
            raise HTTPException(401, "bad bearer")

    body = await req.json()
    text = (body or {}).get("text") or ""
    session = (body or {}).get("session") or "castle-default"
    if not isinstance(text, str) or not text.strip():
        raise HTTPException(400, "text required")
    if not isinstance(session, str) or not session.strip():
        raise HTTPException(400, "session required")

    return StreamingResponse(_stream(text, session), media_type="application/x-ndjson")


async def _stream(text: str, session: str) -> AsyncIterator[bytes]:
    cmd = [
        "hermes",
        "-z",
        text,
        "--continue",
        session,
        "--accept-hooks",
        "-m",
        MODEL,
        "--provider",
        PROVIDER,
    ]
    env = dict(os.environ)
    env["PYTHONUNBUFFERED"] = "1"

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )

    try:
        assert proc.stdout is not None
        while True:
            chunk = await proc.stdout.read(256)
            if not chunk:
                break
            yield (
                json.dumps(
                    {"type": "text", "delta": chunk.decode("utf-8", "replace")}
                )
                + "\n"
            ).encode("utf-8")

        rc = await proc.wait()
        if rc != 0:
            assert proc.stderr is not None
            err = (await proc.stderr.read()).decode("utf-8", "replace")
            yield (
                json.dumps(
                    {
                        "type": "error",
                        "message": err.strip()
                        or f"hermes exited with code {rc}",
                    }
                )
                + "\n"
            ).encode("utf-8")
    except asyncio.CancelledError:
        if proc.returncode is None:
            proc.kill()
        raise
    finally:
        if proc.returncode is None:
            try:
                proc.kill()
            except ProcessLookupError:
                pass

    yield (json.dumps({"type": "done"}) + "\n").encode("utf-8")


@app.exception_handler(HTTPException)
async def http_exception_handler(_req: Request, exc: HTTPException):
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)
