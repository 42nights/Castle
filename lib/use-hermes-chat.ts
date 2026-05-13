"use client";

import { useQuery } from "convex/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
};

export type ChatStatus = "idle" | "streaming" | "error";

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
    if (pendingUser !== null) {
      const alreadyInHistory =
        out.length > 0 &&
        out[out.length - 1].role === "user" &&
        out[out.length - 1].text === pendingUser;
      if (!alreadyInHistory) {
        out.push({ id: "u-pending", role: "user", text: pendingUser });
      }
    }
    if (status === "streaming" || streamingText) {
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
            if (tickerRef.current) {
              clearInterval(tickerRef.current);
              tickerRef.current = null;
            }
            setStreamingText("");
            setPendingUser(null);
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
            let ev: { type: string; delta?: string; message?: string };
            try {
              ev = JSON.parse(t);
            } catch {
              continue;
            }
            if (ev.type === "text" && ev.delta) {
              bufferRef.current += ev.delta;
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

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, status, error, sendMessage, stop };
}
