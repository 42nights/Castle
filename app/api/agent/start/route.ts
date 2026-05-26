import { api } from "@/convex/_generated/api";
import { fetchAuthMutation } from "@/lib/auth-server";
import { mintKickoffToken, mintWriteToken, sha256Hex } from "@/lib/turn-token";

export const runtime = "nodejs";
// Now short — we just kick off Railway and return. No more long
// streaming over Vercel's 300s budget.
export const maxDuration = 30;

type AttachmentInput = {
  storageId: string;
  name: string;
  contentType?: string;
  size?: number;
};

type StartBody = {
  conversationId: string;
  text: string;
  attachments?: AttachmentInput[];
};

/**
 * Kickoff a long-running agent turn.
 *
 *   1. Atomically insert user message + assistant placeholder + agent_turns
 *      row (status=queued) via `agentTurns.startTurn`. The mutation now
 *      derives the actor from the forwarded Better Auth identity and
 *      enforces conversation ownership / visibility — the client cannot
 *      pass an arbitrary actor_slug.
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
  const hasText = typeof body.text === "string" && body.text.trim().length > 0;
  const hasAttachments = Array.isArray(body.attachments) && body.attachments.length > 0;
  if (!body.conversationId || (!hasText && !hasAttachments)) {
    return Response.json(
      { error: "conversationId and text or attachments required" },
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
    return Response.json({ error: "HERMES_URL not set" }, { status: 500 });
  }

  // Atomic create: user message + assistant placeholder + agent_turns
  // (status=queued). Auth-forwarded — Convex sees the Better Auth user
  // and rejects if they can't access this conversation.
  let started: {
    turn_id: string;
    user_message_id: string;
    assistant_message_id: string;
    hermes_session: string;
    visibility: "personal" | "shared";
    actor_slug: string;
    attachment_links: Array<{
      name: string;
      url: string;
      contentType?: string;
    }>;
  };
  try {
    started = (await fetchAuthMutation(api.agentTurns.startTurn, {
      conversation_id: body.conversationId as never,
      user_text: body.text,
      attachments: body.attachments as never,
    })) as typeof started;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "could not start turn";
    const status = /unauth/i.test(msg)
      ? 401
      : /forbidden/i.test(msg)
        ? 403
        : 500;
    console.error("[agent/start] startTurn failed:", err);
    return Response.json({ error: msg }, { status });
  }

  const sessionName = started.hermes_session;
  const actor = started.actor_slug;

  // Mint the tokens.
  const writeToken = mintWriteToken(secret, { turnId: started.turn_id });
  const kickoffBody = {
    turnId: started.turn_id,
    conversationId: body.conversationId,
    actorSlug: actor,
    hermesSession: sessionName,
    visibility: started.visibility,
    text: body.text,
    attachments: started.attachment_links,
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
      await fetchAuthMutation(api.agentTurns.failFromRoute, {
        turn_id: started.turn_id as never,
        error: errMsg,
      }).catch(() => {
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
    await fetchAuthMutation(api.agentTurns.failFromRoute, {
      turn_id: started.turn_id as never,
      error: errMsg,
    }).catch(() => {
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
