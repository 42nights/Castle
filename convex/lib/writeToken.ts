import type { Doc } from "../_generated/dataModel";

/**
 * Web Crypto-based write-token verification for use inside Convex
 * mutations. Matches the format minted by `lib/turn-token.ts`
 * (`mintWriteToken`): a `${base64url(payload)}.${base64url(hmac)}`
 * envelope where payload is `{ k:"write", turnId, exp }` signed with
 * `CASTLE_STREAM_SECRET`.
 *
 * Convex's V8 runtime has Web Crypto but not Node's `crypto`, hence
 * the divergent helper.
 */

function b64urlDecodeToBytes(s: string): Uint8Array {
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  const std = padded.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(std);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlEncodeBytes(bytes: ArrayBuffer): string {
  let bin = "";
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i++) bin += String.fromCharCode(view[i]);
  return btoa(bin)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacSha256B64Url(
  secret: string,
  msg: string,
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return b64urlEncodeBytes(sig);
}

type WriteClaims = {
  k: "write";
  turnId: string;
  exp: number;
};

export async function verifyWriteTokenInConvex(args: {
  token: string;
  turnId: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const secret = process.env.CASTLE_STREAM_SECRET;
  if (!secret) return { ok: false, reason: "CASTLE_STREAM_SECRET missing" };
  const dot = args.token.indexOf(".");
  if (dot < 1) return { ok: false, reason: "malformed" };
  const payloadB64 = args.token.slice(0, dot);
  const sig = args.token.slice(dot + 1);
  let payloadStr: string;
  try {
    payloadStr = new TextDecoder().decode(b64urlDecodeToBytes(payloadB64));
  } catch {
    return { ok: false, reason: "malformed payload" };
  }
  const expected = await hmacSha256B64Url(secret, payloadStr);
  if (!timingSafeEqualStrings(sig, expected)) {
    return { ok: false, reason: "bad signature" };
  }
  let claims: WriteClaims;
  try {
    claims = JSON.parse(payloadStr) as WriteClaims;
  } catch {
    return { ok: false, reason: "bad json" };
  }
  if (claims.k !== "write") return { ok: false, reason: "wrong kind" };
  if (claims.turnId !== args.turnId) {
    return { ok: false, reason: "turnId mismatch" };
  }
  if (claims.exp * 1000 < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true };
}

/** Assert the write token is valid; throw if not. Use in mutations. */
export async function assertWriteToken(args: {
  token: string;
  turnId: string;
}): Promise<void> {
  const res = await verifyWriteTokenInConvex(args);
  if (!res.ok) {
    throw new Error(`unauthorized: ${res.reason}`);
  }
}

export type TurnDoc = Doc<"agent_turns">;
