import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";
export const maxDuration = 15;

type CancelBody = {
  actorSlug: string | null;
  turnId: string;
};

function convex(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  return url ? new ConvexHttpClient(url) : null;
}

/**
 * Cancel an active agent turn. Flips `agent_turns.status = "canceled"`
 * in Convex and best-effort pings the Hermes wrapper's
 * `/agent/cancel/{turnId}` so it aborts its asyncio task immediately
 * (rather than waiting for its 2s status-poll to notice).
 */
export async function POST(req: Request) {
  const body = (await req.json()) as CancelBody;
  const actor = body.actorSlug ?? "anon";
  const cx = convex();
  if (!cx) {
    return Response.json(
      { error: "NEXT_PUBLIC_CONVEX_URL not set" },
      { status: 500 },
    );
  }
  if (!body.turnId) {
    return Response.json({ error: "turnId required" }, { status: 400 });
  }
  try {
    await cx.mutation(api.agentTurns.cancel, {
      turn_id: body.turnId as never,
      actor_slug: actor,
    });
  } catch (err) {
    console.error("[agent/cancel] mutation failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "cancel failed" },
      { status: 500 },
    );
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
