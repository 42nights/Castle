import { api } from "@/convex/_generated/api";
import { fetchAuthMutation } from "@/lib/auth-server";
import { mintKickoffToken, mintWriteToken, sha256Hex } from "@/lib/turn-token";

export const runtime = "nodejs";
export const maxDuration = 30;

type RegenBody = {
  conversationId: string;
};

/**
 * Regenerate the latest assistant turn in a conversation. Deletes the
 * old assistant message + turn rows in Convex (`agentTurns.regenerateLast`)
 * and kicks off Railway with the same user text + session, so the agent
 * re-answers against the same memory.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as RegenBody;
  if (!body.conversationId) {
    return Response.json({ error: "conversationId required" }, { status: 400 });
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

  let started: {
    turn_id: string;
    user_message_id: string;
    assistant_message_id: string;
    hermes_session: string;
    visibility: "personal" | "shared";
    actor_slug: string;
    user_text: string;
    attachment_links: Array<{
      name: string;
      url: string;
      contentType?: string;
    }>;
  };
  try {
    started = (await fetchAuthMutation(api.agentTurns.regenerateLast, {
      conversation_id: body.conversationId as never,
    })) as typeof started;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "could not regenerate";
    const status = /unauth/i.test(msg)
      ? 401
      : /forbidden/i.test(msg)
        ? 403
        : /no turn|already running/i.test(msg)
          ? 409
          : 500;
    return Response.json({ error: msg }, { status });
  }

  const writeToken = mintWriteToken(secret, { turnId: started.turn_id });
  const kickoffBody = {
    turnId: started.turn_id,
    conversationId: body.conversationId,
    actorSlug: started.actor_slug,
    hermesSession: started.hermes_session,
    visibility: started.visibility,
    text: started.user_text,
    attachments: started.attachment_links,
    writeToken,
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
  };
  const kickoffBodyJson = JSON.stringify(kickoffBody);
  const kickoffToken = mintKickoffToken(secret, {
    turnId: started.turn_id,
    conversationId: body.conversationId,
    actorSlug: started.actor_slug,
    hermesSession: started.hermes_session,
    bodyHash: sha256Hex(kickoffBodyJson),
  });

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
      }).catch(() => {});
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
    }).catch(() => {});
    return Response.json({ error: errMsg }, { status: 502 });
  }

  return Response.json({
    turnId: started.turn_id,
    assistantMessageId: started.assistant_message_id,
  });
}
