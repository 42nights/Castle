/**
 * loom-agent-worker — a lightweight stand-in for the Hermes Railway wrapper,
 * used to make the Castle chat answer LIVE for the demo Loom.
 *
 * It speaks the exact same wire protocol the Next `/api/agent/start` route
 * expects (POST /agent/start with X-Castle-Kickoff + a kickoff body carrying
 * the per-turn write_token), then drives a real Claude turn through the AI SDK
 * with a working `list_attention` tool and streams the result into Convex as
 * the same rows (agent_message_chunks + agent_tool_events incl `tool_result`)
 * that the production wrapper writes — so the UI's NarrationRibbon + tool-result
 * renderer registry light up identically. Real model, real Castle data, real
 * widgets. Local/dev only.
 *
 *   ANTHROPIC_API_KEY, CASTLE_STREAM_SECRET (match Next), NEXT_PUBLIC_CONVEX_URL
 *   run: pnpm tsx scripts/loom-agent-worker.ts   (listens on :8790)
 */
import http from "node:http";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, stepCountIs, tool } from "ai";
import { z } from "zod";

const PORT = Number(process.env.LOOM_WORKER_PORT ?? 8790);
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL!;
const MODEL = process.env.LOOM_MODEL ?? "claude-sonnet-4-5";
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are Hermes, the operating assistant inside Castle — 42nights' internal console.
You are answering a 42nights operator. Be calm, specific, and brief.
When the operator asks what is wrong / red / needs attention, call the list_attention tool, then write a SHORT synthesis: 2-4 sentences naming the most critical items by name and the single next action. Do not restate every row — the UI already shows the cards. No preamble, no "happy to help".`;

function jsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => {
      try { resolve(JSON.parse(s || "{}")); } catch { resolve({}); }
    });
  });
}

async function runTurn(kick: {
  turnId: string;
  text: string;
  writeToken: string;
}) {
  const convex = new ConvexHttpClient(CONVEX_URL);
  const turn_id = kick.turnId as never;
  const write_token = kick.writeToken;
  let evSeq = 0;
  let chSeq = 0;
  const appendEvent = (e: Record<string, unknown>) =>
    convex.mutation(api.agentToolEvents.append, {
      turn_id, write_token, seq: evSeq++, ...e,
    } as never);
  const appendChunk = (delta: string) =>
    convex.mutation(api.agentMessageChunks.append, {
      turn_id, write_token, seq: chSeq++, delta,
    } as never);

  let hb: NodeJS.Timeout | undefined;
  const parts: string[] = [];
  try {
    await convex.mutation(api.agentTurns.claimQueued, { turn_id, write_token } as never);
    hb = setInterval(
      () => convex.mutation(api.agentTurns.heartbeat, { turn_id, write_token } as never).catch(() => {}),
      10_000,
    );

    await appendEvent({ kind: "thought", delta: "Reading the attention queue…" });

    const result = streamText({
      model: anthropic(MODEL),
      system: SYSTEM,
      prompt: kick.text,
      stopWhen: stepCountIs(4),
      maxOutputTokens: 400,
      tools: {
        list_attention: tool({
          description:
            "Return the current Castle attention queue: derived + manual items, severity-sorted (critical, high, medium). Call this to see what is red/at-risk right now.",
          inputSchema: z.object({}),
          execute: async () => {
            const callId = `call_attn_${Date.now()}`;
            await appendEvent({ kind: "tool_start", tool_call_id: callId, name: "list_attention" });
            const items = (await convex.query(api.attention.list, {
              nowBucket: Math.floor(Date.now() / 60000),
            } as never)) as unknown[];
            await appendEvent({
              kind: "tool_result",
              tool_call_id: callId,
              name: "list_attention",
              result_json: JSON.stringify(items).slice(0, 180_000),
            });
            await appendEvent({ kind: "tool_end", tool_call_id: callId, name: "list_attention", ok: true });
            return items;
          },
        }),
      },
    });

    // Stream the synthesis text into Convex, coalescing ~350ms.
    let buf = "";
    let lastFlush = Date.now();
    const flush = async () => {
      if (!buf) return;
      const d = buf; buf = ""; lastFlush = Date.now();
      parts.push(d);
      await appendChunk(d);
    };
    for await (const chunk of result.textStream) {
      buf += chunk;
      if (Date.now() - lastFlush > 350 || buf.length > 240) await flush();
    }
    await flush();

    const finalText = (await result.text) || parts.join("");
    if (hb) clearInterval(hb);
    await convex.mutation(api.agentTurns.complete, {
      turn_id, write_token, final_text: finalText, stop_reason: "end_turn",
    } as never);
    console.log(`[worker] turn ${kick.turnId} complete (${finalText.length} chars)`);
  } catch (err) {
    if (hb) clearInterval(hb);
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[worker] turn ${kick.turnId} failed:`, msg);
    await convex
      .mutation(api.agentTurns.fail, {
        turn_id, write_token, error: msg.slice(0, 500), partial_text: parts.join(""),
      } as never)
      .catch(() => {});
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/healthz") {
    res.writeHead(200).end("ok");
    return;
  }
  if (req.method === "POST" && req.url === "/agent/start") {
    const body = await jsonBody(req);
    if (!body?.turnId || !body?.writeToken) {
      res.writeHead(400).end("missing turnId/writeToken");
      return;
    }
    // Accept immediately (route awaits a 202 within 5s), then process async.
    res.writeHead(202).end("accepted");
    runTurn({ turnId: body.turnId, text: body.text ?? "", writeToken: body.writeToken }).catch(
      (e) => console.error("[worker] runTurn crash:", e),
    );
    return;
  }
  res.writeHead(404).end("not found");
});

server.listen(PORT, () => {
  console.log(`[loom-agent-worker] listening on :${PORT}  model=${MODEL}  convex=${CONVEX_URL}`);
});
