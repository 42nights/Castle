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

/**
 * Castle chat → Hermes (running in OrbStack VM `hermes-dev`).
 *
 * Each request shells out to `hermes -z <prompt> --continue castle-<actor>`
 * via `orb run`, so the conversation persists in Hermes' session store
 * (FTS5-indexed) and benefits from its memory + skill loop. Castle's
 * MCP server (`scripts/castle-mcp.ts`) is wired into Hermes as the
 * `castle` MCP, so tools like `engagement_move_phase`, `customer_set_mrr`
 * land inside this same loop.
 *
 * We stream NDJSON back to the browser. Each line is a JSON event:
 *   {type: "text", delta: "..."}   incremental text chunk
 *   {type: "done"}                  end of turn
 *   {type: "error", message: "..."}
 *
 * Hermes does not yet emit structured tool-call events on stdout for
 * the `-z` path — that's a future addition. For now the operator sees
 * the assistant text, and tool calls happen invisibly via MCP.
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

  // Look up the conversation to get its Hermes session name. Each
  // conversation has its own session, so memory doesn't bleed between
  // chats in the sidebar.
  const conv = (await cx.query(api.agentMessages.listConversations, {
    actor_slug: actor,
  })) as Array<{ _id: string; hermes_session: string }>;
  const target = conv.find((c) => c._id === body.conversationId);
  if (!target) {
    return Response.json({ error: "conversation not found" }, { status: 404 });
  }
  const sessionName = target.hermes_session;

  // Persist the user turn before we start streaming. The assistant turn
  // is persisted at the end of the stream from accumulated chunks.
  cx.mutation(api.agentMessages.append, {
    conversation_id: body.conversationId as never,
    actor_slug: actor,
    role: "user",
    text: body.text,
  }).catch((err) => console.error("[agent] failed to log user turn:", err));

  // Hermes flags:
  //   -z PROMPT             one-shot non-interactive
  //   --continue NAME       resume named session so memory accumulates
  //   --accept-hooks        skip TTY prompts for shell-hook approvals
  //   --pass-session-id     emit session id on first line (helpful later)
  // `stdbuf -oL` forces line-buffered stdout on the Hermes side so we
  // get chunks as soon as a line is emitted, not after Hermes exits.
  // `PYTHONUNBUFFERED=1` is a belt-and-suspenders for Python's buffer.
  const child = spawn(
    "orb",
    [
      "-m",
      "hermes-dev",
      "bash",
      "-lc",
      // Pin model explicitly so a config edit elsewhere can't downgrade
      // us silently. Castle is Opus-only for now.
      `PYTHONUNBUFFERED=1 stdbuf -oL -eL hermes -z ${shellQuote(body.text)} --continue ${shellQuote(sessionName)} --accept-hooks -m claude-opus-4-7 --provider anthropic`,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      const emit = (ev: object) => {
        controller.enqueue(enc.encode(JSON.stringify(ev) + "\n"));
      };

      let assistantText = "";
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        // Hermes prints incremental chunks; forward verbatim and accumulate
        // for the end-of-stream Convex append.
        assistantText += chunk;
        emit({ type: "text", delta: chunk });
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
        } else if (assistantText.trim()) {
          cx.mutation(api.agentMessages.append, {
            conversation_id: body.conversationId as never,
            actor_slug: actor,
            role: "assistant",
            text: assistantText.trim(),
          }).catch((err) =>
            console.error("[agent] failed to log assistant turn:", err),
          );
        }
        emit({ type: "done" });
        controller.close();
      });

      child.on("error", (err) => {
        emit({ type: "error", message: err.message });
        emit({ type: "done" });
        controller.close();
      });

      // If the client aborts, kill the subprocess.
      req.signal.addEventListener("abort", () => {
        child.kill("SIGINT");
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

/** Single-quote a string for safe inclusion in `bash -lc '<...>'`. */
function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
