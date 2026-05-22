"""Minimal Convex HTTP client for the Hermes wrapper.

Calls Convex's /api/mutation and /api/query endpoints over httpx.
We don't need the full `convex` package for this — three call sites
total (claim, append chunk, append tool event, heartbeat, complete,
fail, query for cancellation status).

URL: <NEXT_PUBLIC_CONVEX_URL>/api/mutation
Body: {"path": "agentTurns:claimQueued", "args": {...}, "format": "json"}

Public mutations are gated by our write token (verified inside the
Convex mutation handler). Convex itself doesn't require a deploy key
for public function calls.
"""

from __future__ import annotations

import asyncio
from typing import Any, Optional

import httpx


class ConvexClient:
    def __init__(self, base_url: str, timeout_sec: float = 10.0) -> None:
        self.base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(timeout=timeout_sec)

    async def close(self) -> None:
        await self._client.aclose()

    async def mutation(self, path: str, args: dict[str, Any]) -> Any:
        return await self._call("mutation", path, args)

    async def query(self, path: str, args: dict[str, Any]) -> Any:
        return await self._call("query", path, args)

    async def _call(self, kind: str, path: str, args: dict[str, Any]) -> Any:
        url = f"{self.base_url}/api/{kind}"
        # Retry up to 3 times with quick backoff on transient network
        # failures. Convex itself rarely 5xx; this is almost entirely
        # for momentary DNS / connection blips when the wrapper has
        # been idle.
        last_err: Optional[Exception] = None
        for attempt in range(3):
            try:
                res = await self._client.post(
                    url,
                    json={"path": path, "args": args, "format": "json"},
                )
                if res.status_code >= 500:
                    last_err = RuntimeError(f"convex {kind} {path} {res.status_code}: {res.text[:200]}")
                    await asyncio.sleep(0.2 * (attempt + 1))
                    continue
                data = res.json()
                if data.get("status") == "success":
                    return data.get("value")
                # Convex returns 200 with status=error for app-level errors.
                err = data.get("errorMessage") or data.get("error") or "unknown"
                raise RuntimeError(f"convex {kind} {path} failed: {err}")
            except httpx.HTTPError as e:
                last_err = e
                await asyncio.sleep(0.2 * (attempt + 1))
        assert last_err is not None
        raise last_err
