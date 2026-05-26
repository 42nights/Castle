import { api } from "@/convex/_generated/api";
import { fetchAuthMutation } from "@/lib/auth-server";

export const runtime = "nodejs";
export const maxDuration = 15;

type CancelBody = {
  turnId: string;
};

/**
 * Cancel an active agent turn. Flips `agent_turns.status = "canceled"`
 * in Convex (Convex re-checks the caller's identity against the turn's
 * conversation) and best-effort pings the Hermes wrapper's
 * `/agent/cancel/{turnId}` so it aborts its asyncio task immediately
 * (rather than waiting for its status-poll to notice).
 */
export async function POST(req: Request) {
  const body = (await req.json()) as CancelBody;
  if (!body.turnId) {
    return Response.json({ error: "turnId required" }, { status: 400 });
  }
  try {
    await fetchAuthMutation(api.agentTurns.cancel, {
      turn_id: body.turnId as never,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "cancel failed";
    const status = /unauth/i.test(msg)
      ? 401
      : /forbidden/i.test(msg)
        ? 403
        : 500;
    console.error("[agent/cancel] mutation failed:", err);
    return Response.json({ error: msg }, { status });
  }
  // Best-effort wrapper ping. If it 404s or times out, the wrapper's
  // own status poll will pick up the canceled state within ~2s.
  const hermesUrl = process.env.HERMES_URL;
  if (hermesUrl) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2_000);
    try {
      await fetch(
        `${hermesUrl.replace(/\/$/, "")}/agent/cancel/${encodeURIComponent(body.turnId)}`,
        { method: "POST", signal: ctrl.signal },
      ).catch(() => {});
    } catch {
      /* noop */
    }
    clearTimeout(t);
  }
  return Response.json({ ok: true });
}
