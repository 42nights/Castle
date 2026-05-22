import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  mintKickoffToken,
  mintWriteToken,
  sha256Hex,
} from "@/lib/turn-token";

export const runtime = "nodejs";
// Now short — we just kick off Railway and return. No more long
// streaming over Vercel's 300s budget.
export const maxDuration = 30;

type StartBody = {
  actorSlug: string | null;
  conversationId: string;
  text: string;
};

function convex(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  return url ? new ConvexHttpClient(url) : null;
}

/**
 * Kickoff a long-running agent turn.
 *
 *   1. Atomically insert user message + assistant placeholder + agent_turns
 *      row (status=queued) via `agentTurns.startTurn`.
 *   2. Mint a kickoff token (HMAC bound to body hash + exp) and a write
 *      token (HMAC bound to the new turnId).
 *   3. POST `/agent/start` to Railway, await its 202 (≤5s).
 *   4. If Railway accepts, return `{ turnId, assistantMessageId }`.
 *      If Railway is unreachable, mark the turn `failed` and return 502.
 *
 * The client subscribes to `api.agentTurns.activeFor` to watch the
 * stream as it lands in Convex.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as StartBody;
  const actor = body.actorSlug ?? "anon";
  const cx = convex();
  if (!cx) {
    return Response.json(
      { error: "NEXT_PUBLIC_CONVEX_URL not set" },
      { status: 500 },
    );
  }
  if (!body.conversationId || !body.text?.trim()) {
    return Response.json(
      { error: "conversationId + text required" },
      { status: 400 },
    );
  }
  const secret = process.env.CASTLE_STREAM_SECRET;
  if (!secret) {
    return Response.json(
      { error: "CASTLE_STREAM_SECRET not set" },
      { status: 500 },
    );
  }
  const hermesUrl = process.env.HERMES_URL;
  if (!hermesUrl) {
    return Response.json(
      { error: "HERMES_URL not set" },
      { status: 500 },
    );
  }

  // Look up the conversation to get its Hermes session name.
  const conv = (await cx.query(api.agentMessages.listConversations, {
    actor_slug: actor,
  })) as Array<{ _id: string; hermes_session: string }>;
  const target = conv.find((c) => c._id === body.conversationId);
  if (!target) {
    return Response.json({ error: "conversation not found" }, { status: 404 });
  }
  const sessionName = target.hermes_session;

  // Atomic create: user message + assistant placeholder + agent_turns
  // (status=queued).
  let started: {
    turn_id: string;
    user_message_id: string;
    assistant_message_id: string;
  };
  try {
    started = (await cx.mutation(api.agentTurns.startTurn, {
      conversation_id: body.conversationId as never,
      actor_slug: actor,
      user_text: body.text,
      hermes_session: sessionName,
    })) as typeof started;
  } catch (err) {
    console.error("[agent/start] startTurn failed:", err);
    return Response.json(
      { error: "could not start turn" },
      { status: 500 },
    );
  }

  // Mint the tokens.
  const writeToken = mintWriteToken(secret, { turnId: started.turn_id });
  const kickoffBody = {
    turnId: started.turn_id,
    conversationId: body.conversationId,
    actorSlug: actor,
    hermesSession: sessionName,
    text: body.text,
    writeToken,
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
  };
  const kickoffBodyJson = JSON.stringify(kickoffBody);
  const kickoffToken = mintKickoffToken(secret, {
    turnId: started.turn_id,
    conversationId: body.conversationId,
    actorSlug: actor,
    hermesSession: sessionName,
    bodyHash: sha256Hex(kickoffBodyJson),
  });

  // POST kickoff to Railway. Await its 202.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(`${hermesUrl.replace(/\/$/, "")}/agent/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Castle-Kickoff": kickoffToken,
      },
      body: kickoffBodyJson,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.status !== 202) {
      const detail = await res.text().catch(() => "");
      const errMsg = `hermes /agent/start ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`;
      await cx
        .mutation(api.agentTurns.failFromRoute, {
          turn_id: started.turn_id as never,
          actor_slug: actor,
          error: errMsg,
        })
        .catch(() => {
          /* sweep cron will catch it */
        });
      return Response.json({ error: errMsg }, { status: 502 });
    }
  } catch (err) {
    clearTimeout(timeoutId);
    const errMsg =
      err instanceof Error && err.name === "AbortError"
        ? "hermes /agent/start timeout (>5s)"
        : `hermes /agent/start unreachable: ${
            err instanceof Error ? err.message : "unknown"
          }`;
    await cx
      .mutation(api.agentTurns.failFromRoute, {
        turn_id: started.turn_id as never,
        actor_slug: actor,
        error: errMsg,
      })
      .catch(() => {
        /* sweep cron will catch it */
      });
    return Response.json({ error: errMsg }, { status: 502 });
  }

  return Response.json({
    turnId: started.turn_id,
    userMessageId: started.user_message_id,
    assistantMessageId: started.assistant_message_id,
  });
}
