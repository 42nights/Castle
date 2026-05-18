import { spawn } from "node:child_process";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";
export const maxDuration = 300;

type ChatBody = {
  actorSlug: string | null;
  conversationId: string;
  text: string;
};

function convex(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  return url ? new ConvexHttpClient(url) : null;
}

// Hermes runs in a real terminal context and sometimes leaks ANSI escape
// sequences (color codes, cursor moves, line clears) into stdout. Browsers
// pass these through as raw control chars — invisible at best, garbling the
// markdown render at worst. Strip them server-side before they hit the wire.
// Pattern covers CSI sequences (ESC [ ... letter) and OSC sequences
// (ESC ] ... BEL or ESC ] ... ESC \).
const ANSI_RE = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

/**
 * Castle chat → Hermes.
 *
 * Two backends:
 *   - HERMES_URL set (prod / Vercel): POST {session,text} to the
 *     Railway-hosted Hermes FastAPI wrapper. Same NDJSON wire format.
 *   - HERMES_URL unset (local dev): `spawn("orb", …)` into the
 *     OrbStack-hosted Hermes VM. Subprocess streaming over stdout.
 *
 * In both cases each conversation has its own Hermes session name so
 * memory doesn't bleed between chats in the sidebar.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as ChatBody;
  const actor = body.actorSlug ?? "anon";
  const cx = convex();
  if (!cx) {
    return Response.json(
      { error: "NEXT_PUBLIC_CONVEX_URL not set" },
      { status: 500 },
    );
  }
  if (!body.conversationId) {
    return Response.json({ error: "conversationId required" }, { status: 400 });
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

  // Persist the user turn immediately.
  cx.mutation(api.agentMessages.append, {
    conversation_id: body.conversationId as never,
    actor_slug: actor,
    role: "user",
    text: body.text,
  }).catch((err) => console.error("[agent] failed to log user turn:", err));

  // Common end-of-stream: persist the accumulated assistant text.
  const persistAssistant = (text: string) => {
    if (!text.trim()) return;
    cx.mutation(api.agentMessages.append, {
      conversation_id: body.conversationId as never,
      actor_slug: actor,
      role: "assistant",
      text: text.trim(),
    }).catch((err) =>
      console.error("[agent] failed to log assistant turn:", err),
    );
  };

  // If the wrapper mints a new ACP session (because the legacy
  // `castle-<slug>-<rand>` string doesn't resolve via session/load, or
  // this is a brand-new conversation), it emits a `{type:"session",
  // session_id}` frame. Bind that id back to Convex so subsequent turns
  // reuse it. Field stays opaque to the rest of the system.
  const onSessionBound = (newSessionId: string) => {
    if (newSessionId === sessionName) return;
    cx.mutation(api.agentMessages.bindSession, {
      id: body.conversationId as never,
      hermes_session: newSessionId,
    }).catch((err) =>
      console.error("[agent] failed to bind ACP session id:", err),
    );
  };

  const hermesUrl = process.env.HERMES_URL;
  const stream = hermesUrl
    ? remoteHermesStream(
        hermesUrl,
        process.env.CASTLE_HERMES_TOKEN ?? "",
        sessionName,
        body.text,
        req.signal,
        persistAssistant,
        onSessionBound,
      )
    : localOrbStream(sessionName, body.text, req.signal, persistAssistant);

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

/** Forward to Hermes' FastAPI wrapper on Railway, re-streaming its NDJSON. */
function remoteHermesStream(
  baseUrl: string,
  bearer: string,
  session: string,
  text: string,
  abort: AbortSignal,
  onComplete: (assistantText: string) => void,
  onSessionBound?: (sessionId: string) => void,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const emit = (ev: object) =>
        controller.enqueue(enc.encode(JSON.stringify(ev) + "\n"));
      let assistantText = "";

      try {
        const res = await fetch(`${baseUrl.replace(/\/$/, "")}/agent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          },
          body: JSON.stringify({ session, text }),
          signal: abort,
        });
        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "");
          emit({
            type: "error",
            message: `hermes ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
          });
          emit({ type: "done" });
          controller.close();
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (!t) continue;
            // Each upstream line is already NDJSON — pass through, but
            // accumulate text deltas for the Convex append.
            let parsed: { type?: string; delta?: string } | null = null;
            try {
              parsed = JSON.parse(t);
            } catch {
              continue;
            }
            if (parsed?.type === "text" && parsed.delta) {
              const clean = stripAnsi(parsed.delta);
              assistantText += clean;
              // Re-serialize so the wire frame matches what we accumulated.
              controller.enqueue(
                enc.encode(JSON.stringify({ ...parsed, delta: clean }) + "\n"),
              );
              continue;
            }
            // ACP-era: wrapper announces a freshly-minted session id once
            // per turn. Bind it back to Convex so the next turn reuses
            // it via `session/load`. Don't forward to the client — it's
            // an internal-routing concern, not a UI event.
            if (
              parsed?.type === "session" &&
              typeof (parsed as { session_id?: unknown }).session_id ===
                "string" &&
              onSessionBound
            ) {
              onSessionBound(
                (parsed as { session_id: string }).session_id,
              );
              continue;
            }
            controller.enqueue(enc.encode(t + "\n"));
          }
        }
        if (buf.trim()) controller.enqueue(enc.encode(buf + "\n"));
        onComplete(assistantText);
      } catch (err) {
        if (!abort.aborted) {
          emit({
            type: "error",
            message: err instanceof Error ? err.message : "fetch failed",
          });
          emit({ type: "done" });
        }
      }
      controller.close();
    },
  });
}

/** Local dev: subprocess into the OrbStack VM. */
function localOrbStream(
  sessionName: string,
  text: string,
  abort: AbortSignal,
  onComplete: (assistantText: string) => void,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      const emit = (ev: object) =>
        controller.enqueue(enc.encode(JSON.stringify(ev) + "\n"));

      const child = spawn(
        "orb",
        [
          "-m",
          "hermes-dev",
          "bash",
          "-lc",
          `PYTHONUNBUFFERED=1 stdbuf -oL -eL hermes -z ${shellQuote(text)} --continue ${shellQuote(sessionName)} --accept-hooks -m claude-opus-4-7 --provider anthropic`,
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );

      let assistantText = "";
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        const clean = stripAnsi(chunk);
        if (!clean) return;
        assistantText += clean;
        emit({ type: "text", delta: clean });
      });

      let stderr = "";
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });

      child.on("close", (code) => {
        if (code !== 0) {
          emit({
            type: "error",
            message:
              stderr.trim() || `hermes exited with code ${code ?? "?"}`,
          });
        } else {
          onComplete(assistantText);
        }
        emit({ type: "done" });
        controller.close();
      });

      child.on("error", (err) => {
        emit({ type: "error", message: err.message });
        emit({ type: "done" });
        controller.close();
      });

      abort.addEventListener("abort", () => child.kill("SIGINT"));
    },
  });
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
