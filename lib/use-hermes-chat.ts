"use client";

import { useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
};

export type ChatStatus = "idle" | "streaming" | "error";

export type ToolActivity = {
  id: string;
  name: string;
  kind?: string;
  status: "running" | "done" | "error";
  startedAt: number;
  durationMs?: number;
};

type ConvexMessage = {
  _id: string;
  role: "user" | "assistant";
  text: string;
};

/**
 * Castle chat hook — scoped to a single conversation.
 *
 * - History comes from Convex (`agent_messages` filtered by conversation),
 *   reactive across reloads and tabs.
 * - The in-flight streaming turn is local state until `/api/agent`
 *   finishes; at that point the server persists it and the reactive
 *   query picks it up.
 */
export function useHermesChat({
  actorSlug,
  conversationId,
}: {
  actorSlug: string | null;
  conversationId: Id<"agent_conversations"> | null;
}) {
  const historyRaw = useQuery(
    api.agentMessages.list,
    conversationId ? { conversation_id: conversationId } : "skip",
  ) as ConvexMessage[] | undefined;

  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<string>("");
  const [streamingThought, setStreamingThought] = useState<string>("");
  const [tools, setTools] = useState<ToolActivity[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Typewriter reveal — Hermes batches its output, so we accumulate
  // pending characters and drain them at a steady rate to simulate
  // streaming. Cleared when the stream ends.
  const bufferRef = useRef<string>("");
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamDoneRef = useRef(false);

  const messages = useMemo<ChatMessage[]>(() => {
    const out: ChatMessage[] = (historyRaw ?? []).map((m) => ({
      id: m._id,
      role: m.role,
      text: m.text,
    }));
    // History "caught up" = this send's user text is somewhere in the
    // tail of history (so the optimistic user ghost is redundant) AND
    // the last entry is an assistant message (so the streaming ghost is
    // redundant). We check both before the handoff effect clears the
    // optimistic state to avoid a one-frame double-render.
    const userLanded =
      pendingUser !== null &&
      out.some(
        (m, i) =>
          i >= out.length - 2 && m.role === "user" && m.text === pendingUser,
      );
    const assistantLanded =
      userLanded && out[out.length - 1]?.role === "assistant";
    if (pendingUser !== null && !userLanded) {
      out.push({ id: "u-pending", role: "user", text: pendingUser });
    }
    const showStreaming =
      !assistantLanded && (status === "streaming" || streamingText);
    if (showStreaming) {
      out.push({
        id: "a-streaming",
        role: "assistant",
        text: streamingText,
        streaming: status === "streaming",
      });
    }
    return out;
  }, [historyRaw, pendingUser, streamingText, status]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (
        !trimmed ||
        status === "streaming" ||
        !actorSlug ||
        !conversationId
      )
        return;

      setPendingUser(trimmed);
      setStreamingText("");
      setStreamingThought("");
      setTools([]);
      setStatus("streaming");
      setError(null);
      bufferRef.current = "";
      streamDoneRef.current = false;

      // Typewriter reveal. Hermes batches its whole reply at once, so
      // we paint it gradually. ~3 chars per 24ms tick = 125 chars/sec,
      // roughly 30 tokens/sec — the speed real model streaming feels
      // like. If a huge response lands, the rate adapts: we reveal a
      // larger chunk per tick to drain within a sensible bound.
      if (tickerRef.current) clearInterval(tickerRef.current);
      const start = Date.now();
      tickerRef.current = setInterval(() => {
        if (bufferRef.current.length === 0) {
          if (streamDoneRef.current) {
            // Buffer drained. Flip status to idle so the input unlocks
            // immediately, but DON'T clear streamingText / pendingUser
            // yet — Convex's reactive `historyRaw` query takes a beat to
            // reflect the just-persisted assistant turn, and clearing
            // here causes a "flash then empty" gap. The handoff effect
            // below clears them once history catches up (with a short
            // fallback so we never strand the UI on a dropped persist).
            if (tickerRef.current) {
              clearInterval(tickerRef.current);
              tickerRef.current = null;
            }
            setStatus("idle");
          }
          return;
        }
        // Base reveal rate: 3 chars per tick at 24ms.
        // Adaptive: if the buffer is getting huge or stream's done,
        // accelerate so we don't lag minutes behind.
        const elapsed = Date.now() - start;
        let perTick = 3;
        if (streamDoneRef.current && bufferRef.current.length > 500) perTick = 8;
        if (streamDoneRef.current && bufferRef.current.length > 2000) perTick = 24;
        if (elapsed > 30_000) perTick = Math.max(perTick, 12);
        const slice = bufferRef.current.slice(0, perTick);
        bufferRef.current = bufferRef.current.slice(perTick);
        setStreamingText((prev) => prev + slice);
      }, 24);

      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actorSlug,
            conversationId,
            text: trimmed,
          }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(`Agent route failed: ${res.status}`);
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
            let ev: {
              type: string;
              delta?: string;
              message?: string;
              id?: string;
              name?: string;
              kind?: string;
              ok?: boolean;
            };
            try {
              ev = JSON.parse(t);
            } catch {
              continue;
            }
            if (ev.type === "text" && ev.delta) {
              bufferRef.current += ev.delta;
            } else if (ev.type === "thought" && ev.delta) {
              // Reasoning stream — accumulate verbatim (no typewriter),
              // since thoughts are background context rather than the
              // user-facing answer.
              setStreamingThought((prev) => prev + ev.delta);
            } else if (ev.type === "tool_start" && ev.id) {
              const id = ev.id;
              const name = ev.name ?? "tool";
              const kind = ev.kind;
              setTools((prev) => {
                if (prev.some((t) => t.id === id)) return prev;
                return [
                  ...prev,
                  {
                    id,
                    name,
                    kind,
                    status: "running",
                    startedAt: Date.now(),
                  },
                ];
              });
            } else if (ev.type === "tool_end" && ev.id) {
              const id = ev.id;
              const ok = ev.ok !== false;
              setTools((prev) =>
                prev.map((t) =>
                  t.id === id
                    ? {
                        ...t,
                        status: ok ? "done" : "error",
                        durationMs: Date.now() - t.startedAt,
                      }
                    : t,
                ),
              );
            } else if (ev.type === "error") {
              setError(ev.message ?? "Unknown error.");
            } else if (ev.type === "done") {
              // Mark the stream done — the ticker drains the rest and
              // flips status to idle once the buffer is empty.
              streamDoneRef.current = true;
              return;
            }
          }
        }
      } catch (err) {
        if (ac.signal.aborted) {
          if (tickerRef.current) {
            clearInterval(tickerRef.current);
            tickerRef.current = null;
          }
          bufferRef.current = "";
          setStatus("idle");
          setStreamingText("");
          setStreamingThought("");
          setTools([]);
          setPendingUser(null);
          return;
        }
        if (tickerRef.current) {
          clearInterval(tickerRef.current);
          tickerRef.current = null;
        }
        setError(err instanceof Error ? err.message : "Stream failed.");
        setStatus("error");
      }
    },
    [actorSlug, conversationId, status],
  );

  // Handoff: once the persisted history contains an assistant turn at
  // the tail, the optimistic streaming entry has been replaced by the
  // real one, so we can safely clear streamingText + pendingUser. We
  // also schedule a fallback timeout so a dropped persist never strands
  // the UI in a "permanent streaming" state.
  useEffect(() => {
    if (status !== "idle") return;
    if (!streamingText && pendingUser === null) return;
    // History caught up = THIS turn's user message landed in the tail
    // AND the last entry is an assistant message (i.e. our streamed
    // turn was persisted). Matching only on "last role is assistant"
    // is wrong — a prior turn's assistant tail satisfies it before
    // Convex propagates the new pair, which would re-introduce the
    // flash-then-empty gap the patch exists to fix. Same shape as the
    // useMemo dedupe so the two stay consistent.
    const hist = historyRaw ?? [];
    const userLanded =
      pendingUser !== null &&
      hist.some(
        (m, i) =>
          i >= hist.length - 2 && m.role === "user" && m.text === pendingUser,
      );
    const assistantLanded =
      userLanded && hist[hist.length - 1]?.role === "assistant";
    if (assistantLanded) {
      // Schedule on a microtask so React doesn't see a cascading
      // setState during the effect body — the useMemo dedupe already
      // hides the redundant ghosts, so the one-tick delay is invisible.
      // Also clear the per-turn thought/tool buffers — they're scratch
      // state for the in-flight indicator only; we don't persist them.
      const t = setTimeout(() => {
        setStreamingText("");
        setStreamingThought("");
        setTools([]);
        setPendingUser(null);
      }, 0);
      return () => clearTimeout(t);
    }
    // Hermes didn't persist (e.g. tool-only turn, server crash) — keep
    // whatever we streamed as the canonical record in the UI but stop
    // pretending it'll be replaced. pendingUser stays as a fallback so
    // the user always sees their own message; after 4s we drop it so
    // re-renders don't keep matching against stale optimistic state.
    const t = setTimeout(() => setPendingUser(null), 4000);
    return () => clearTimeout(t);
  }, [status, streamingText, pendingUser, historyRaw]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    messages,
    status,
    error,
    sendMessage,
    stop,
    thought: streamingThought,
    tools,
  };
}
