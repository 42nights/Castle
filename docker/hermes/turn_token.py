"""HMAC token verification + minting for the Castle wrapper.

Matches the format in `lib/turn-token.ts`. Tokens are
`base64url(payload_json).base64url(hmac_sha256(secret, payload_json))`.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any, Optional


def _b64url_decode(s: str) -> bytes:
    pad = "=" * ((4 - len(s) % 4) % 4)
    return base64.urlsafe_b64decode(s + pad)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _sign(secret: str, msg: str) -> str:
    sig = hmac.new(secret.encode("utf-8"), msg.encode("utf-8"), hashlib.sha256).digest()
    return _b64url_encode(sig)


def sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


class TokenError(Exception):
    pass


def verify_kickoff_token(
    *,
    token: str,
    secret: str,
    body_hash: str,
    turn_id: str,
) -> dict[str, Any]:
    claims = _unpack(token, secret)
    if claims.get("k") != "kickoff":
        raise TokenError("wrong kind")
    if claims.get("turnId") != turn_id:
        raise TokenError("turnId mismatch")
    if claims.get("bodyHash") != body_hash:
        raise TokenError("body hash mismatch")
    return claims


def verify_write_token(
    *,
    token: str,
    secret: str,
    turn_id: str,
) -> dict[str, Any]:
    claims = _unpack(token, secret)
    if claims.get("k") != "write":
        raise TokenError("wrong kind")
    if claims.get("turnId") != turn_id:
        raise TokenError("turnId mismatch")
    return claims


def mint_write_token(*, secret: str, turn_id: str, ttl_sec: int = 3600) -> str:
    """Re-mint a write token. We accept the one Vercel sent us, but if it
    expires (long agentic flows >1h), regenerate before each Convex call.
    Same secret + claims shape; Convex doesn't care who minted it."""
    payload = json.dumps(
        {
            "k": "write",
            "turnId": turn_id,
            "exp": int(time.time()) + ttl_sec,
        },
        separators=(",", ":"),
    )
    sig = _sign(secret, payload)
    return f"{_b64url_encode(payload.encode('utf-8'))}.{sig}"


def _unpack(token: str, secret: str) -> dict[str, Any]:
    dot = token.find(".")
    if dot < 1:
        raise TokenError("malformed")
    payload_b64 = token[:dot]
    sig = token[dot + 1 :]
    try:
        payload_str = _b64url_decode(payload_b64).decode("utf-8")
    except Exception as e:
        raise TokenError(f"malformed payload: {e}")
    expected = _sign(secret, payload_str)
    if not hmac.compare_digest(sig, expected):
        raise TokenError("bad signature")
    try:
        claims: dict[str, Any] = json.loads(payload_str)
    except Exception as e:
        raise TokenError(f"bad json: {e}")
    exp = claims.get("exp")
    if not isinstance(exp, (int, float)) or exp * 1000 < time.time() * 1000:
        raise TokenError("expired")
    return claims


CASTLE_STREAM_SECRET: Optional[str] = os.environ.get("CASTLE_STREAM_SECRET") or None
