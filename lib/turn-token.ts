import { createHmac, createHash } from "node:crypto";

/**
 * Per-turn signed token used to authorise the Vercel→Railway kickoff
 * and the Railway→Convex streaming writes.
 *
 * Threat model:
 *   - CASTLE_STREAM_SECRET is shared between Vercel + Railway envs.
 *   - We bind every token to a specific turn_id so a leaked token can't
 *     be used to manipulate other turns.
 *   - The kickoff token additionally binds a body hash + expiry so the
 *     payload can't be tampered with or replayed across new requests.
 *
 * Token format: a base64url JSON envelope `{ payload, sig }` where
 * `payload` is a JSON object and `sig` is `hmac-sha256(secret, payload_json)`.
 *
 * Two flavors:
 *   - `mintKickoffToken` — wraps the full Vercel→Railway payload (body
 *     hash, hermes_session, etc) and short expiry.
 *   - `mintWriteToken` — turn-scoped, longer-lived (matches the turn's
 *     plausible upper duration, say 1 hour), used on every Convex
 *     mutation the wrapper sends.
 */

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function b64urlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlDecode(s: string): Buffer {
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(secret: string, msg: string): string {
  return b64urlEncode(createHmac("sha256", secret).update(msg).digest());
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

type KickoffClaims = {
  /** Token kind discriminator — guards against using a write token as a
   *  kickoff token or vice versa. */
  k: "kickoff";
  turnId: string;
  conversationId: string;
  actorSlug: string;
  hermesSession: string;
  /** sha256 of the JSON request body. The wrapper recomputes and
   *  rejects mismatches → no payload swap attacks. */
  bodyHash: string;
  /** Unix epoch seconds. */
  exp: number;
};

type WriteClaims = {
  k: "write";
  turnId: string;
  exp: number;
};

type Claims = KickoffClaims | WriteClaims;

function packToken(claims: Claims, secret: string): string {
  const payload = JSON.stringify(claims);
  const sig = sign(secret, payload);
  return `${b64urlEncode(Buffer.from(payload, "utf8"))}.${sig}`;
}

function unpackToken(
  token: string,
  secret: string,
): { ok: true; claims: Claims } | { ok: false; reason: string } {
  const dot = token.indexOf(".");
  if (dot < 1) return { ok: false, reason: "malformed" };
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payloadStr: string;
  try {
    payloadStr = b64urlDecode(payloadB64).toString("utf8");
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const expected = sign(secret, payloadStr);
  if (!timingSafeEqual(sig, expected)) {
    return { ok: false, reason: "bad signature" };
  }
  let claims: Claims;
  try {
    claims = JSON.parse(payloadStr) as Claims;
  } catch {
    return { ok: false, reason: "bad payload" };
  }
  if (claims.exp * 1000 < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, claims };
}

/**
 * Mint a kickoff token. TTL is short (5 min) — long enough to cover
 * retry windows but short enough that a leaked token expires quickly.
 */
export function mintKickoffToken(
  secret: string,
  args: Omit<KickoffClaims, "k" | "exp"> & { ttlSec?: number },
): string {
  const ttl = args.ttlSec ?? 300;
  return packToken(
    {
      k: "kickoff",
      turnId: args.turnId,
      conversationId: args.conversationId,
      actorSlug: args.actorSlug,
      hermesSession: args.hermesSession,
      bodyHash: args.bodyHash,
      exp: Math.floor(Date.now() / 1000) + ttl,
    },
    secret,
  );
}

/**
 * Mint a write token. Longer TTL (1 hour) — bounded by the plausible
 * upper duration of a single turn. Scoped to one turnId so a leaked
 * token can't be used to scribble over other turns.
 */
export function mintWriteToken(
  secret: string,
  args: { turnId: string; ttlSec?: number },
): string {
  const ttl = args.ttlSec ?? 3600;
  return packToken(
    {
      k: "write",
      turnId: args.turnId,
      exp: Math.floor(Date.now() / 1000) + ttl,
    },
    secret,
  );
}

export type VerifyKickoffArgs = {
  secret: string;
  token: string;
  /** sha256 of the actual request body. */
  bodyHash: string;
  /** Required turnId binding. */
  turnId: string;
};

export function verifyKickoffToken(
  args: VerifyKickoffArgs,
): { ok: true; claims: KickoffClaims } | { ok: false; reason: string } {
  const res = unpackToken(args.token, args.secret);
  if (!res.ok) return res;
  if (res.claims.k !== "kickoff") return { ok: false, reason: "wrong kind" };
  if (res.claims.turnId !== args.turnId) {
    return { ok: false, reason: "turnId mismatch" };
  }
  if (res.claims.bodyHash !== args.bodyHash) {
    return { ok: false, reason: "body hash mismatch" };
  }
  return { ok: true, claims: res.claims };
}

export type VerifyWriteArgs = {
  secret: string;
  token: string;
  turnId: string;
};

export function verifyWriteToken(
  args: VerifyWriteArgs,
): { ok: true; claims: WriteClaims } | { ok: false; reason: string } {
  const res = unpackToken(args.token, args.secret);
  if (!res.ok) return res;
  if (res.claims.k !== "write") return { ok: false, reason: "wrong kind" };
  if (res.claims.turnId !== args.turnId) {
    return { ok: false, reason: "turnId mismatch" };
  }
  return { ok: true, claims: res.claims };
}
