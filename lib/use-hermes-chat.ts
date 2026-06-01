"use client";

import { useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

export type ChatAttachment = {
  storageId: string;
  name: string;
  contentType?: string;
  size?: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
  status?: "streaming" | "complete" | "failed" | "canceled";
  /** ISO timestamp the row was inserted into Convex. Surfaced for
   *  hover-revealed timestamps and CTA-timing logic. */
  createdAt: string;
  /** The agent_turns row that produced this assistant message. Lets the
   *  transcript re-render the turn's tool-result widgets in history. */
  turnId?: string;
  /** Files attached when the operator sent this message. Empty/absent
   *  for assistant rows and user rows sent without attachments. */
  attachments?: ChatAttachment[];
};

export type ChatStatus = "idle" | "streaming" | "error";

export type ToolActivity = {
  id: string;
  name: string;
  kind?: string;
  status: "running" | "done" | "error";
  startedAt: number;
  durationMs?: number;
  /** Parsed result from a tool_result event, if present. */
  result?: unknown;
};

type HistoryRow = Doc<"agent_messages">;
type TurnRow = Doc<"agent_turns">;
type ChunkRow = Doc<"agent_message_chunks">;
type ToolEventRow = Doc<"agent_tool_events">;

type ActiveTurn = {
  turn: TurnRow;
  chunks: ChunkRow[];
  events: ToolEventRow[];
};

/**
 * Castle chat hook — scoped to a single conversation.
 *
 * The long-running agent loop lives on Railway and writes incrementally
 * to Convex. The client only subscribes to Convex via reactive queries
 * — no Vercel-route streaming, no 300s function budget, no NDJSON
 * parsing.
 *
 * - `messages` is the full transcript from `agent_messages`. Streaming
 *   assistant rows show with `streaming: true` until the wrapper writes
 *   a final snapshot.
 * - `tools` / `thought` come from `agent_message_chunks` +
 *   `agent_tool_events` via the `agentTurns.activeFor` query.
 * - A tiny client-side typewriter smooths bursty 500ms chunk arrivals
 *   into token-paced visual output.
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
  ) as HistoryRow[] | undefined;

  const active = useQuery(
    api.agentTurns.activeFor,
    conversationId ? { conversation_id: conversationId } : "skip",
  ) as ActiveTurn | null | undefined;

  // sendMessage's own error (network failure on POST). Server-side
  // turn errors are surfaced via `active.turn.error` below — those are
  // derived state, not stored locally.
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Concatenate streamed chunks. Convex returns chunks sorted by seq
  // via the index, but be defensive — sort again here.
  const streamingText = useMemo(() => {
    if (!active) return "";
    const sorted = [...active.chunks].sort((a, b) => a.seq - b.seq);
    return sorted.map((c) => c.delta).join("");
  }, [active]);

  // Derived tool activity from the event stream.
  const tools = useMemo<ToolActivity[]>(() => {
    if (!active) return [];
    const byId = new Map<string, ToolActivity>();
    const sorted = [...active.events].sort((a, b) => a.seq - b.seq);
    for (const ev of sorted) {
      if (!ev.tool_call_id) continue;
      if (ev.kind === "tool_start") {
        byId.set(ev.tool_call_id, {
          id: ev.tool_call_id,
          name: ev.name ?? "tool",
          status: "running",
          startedAt: new Date(ev.created_at).getTime(),
        });
      } else if (ev.kind === "tool_end") {
        const prev = byId.get(ev.tool_call_id);
        const ok = ev.ok !== false;
        if (prev) {
          byId.set(ev.tool_call_id, {
            ...prev,
            status: ok ? "done" : "error",
            durationMs: new Date(ev.created_at).getTime() - prev.startedAt,
          });
        }
      } else if (ev.kind === "tool_result") {
        const prev = byId.get(ev.tool_call_id);
        if (prev && ev.result_json) {
          let parsed: unknown = undefined;
          try {
            parsed = JSON.parse(ev.result_json);
          } catch {
            // parse failure — leave result undefined
          }
          byId.set(ev.tool_call_id, { ...prev, result: parsed });
        }
      }
    }
    return Array.from(byId.values());
  }, [active]);

  // Latest thought line, accumulated from thought events.
  const thought = useMemo(() => {
    if (!active) return "";
    const sorted = [...active.events]
      .filter((e) => e.kind === "thought")
      .sort((a, b) => a.seq - b.seq);
    return sorted.map((e) => e.delta ?? "").join("");
  }, [active]);

  // Derive client status from the turn row.
  const status: ChatStatus = useMemo(() => {
    if (
      active &&
      (active.turn.status === "queued" || active.turn.status === "running")
    ) {
      return "streaming";
    }
    if (active && active.turn.status === "failed") return "error";
    return "idle";
  }, [active]);

  // Derived error: either the just-attempted send failed locally, or
  // the server marked the active turn as failed.
  const error =
    sendError ??
    (active && active.turn.status === "failed"
      ? (active.turn.error ?? "Turn failed.")
      : null);

  // Build the visible message list. History rows are canonical;
  // assistant rows with status=streaming get their text from the live
  // chunks aggregate. The startTurn mutation already inserted both
  // user + assistant placeholder atomically, so no optimistic ghosts.
  const messages = useMemo<ChatMessage[]>(() => {
    const rows = historyRaw ?? [];
    return rows.map((m) => {
      const isStreaming = m.role === "assistant" && m.status === "streaming";
      // For streaming assistant, prefer the live chunks aggregate over
      // m.text (which is "" until snapshot lands on complete).
      const liveText =
        isStreaming && active && active.turn.assistant_message_id === m._id
          ? streamingText
          : m.text;
      return {
        id: m._id,
        role: m.role,
        text: liveText,
        streaming: isStreaming,
        status: m.status,
        createdAt: m.created_at,
        turnId: m.turn_id as string | undefined,
        attachments: (m as { attachments?: ChatAttachment[] }).attachments,
      };
    });
  }, [historyRaw, active, streamingText]);

  const sendMessage = useCallback(
    async (
      text: string,
      attachments?: Array<{
        storageId: string;
        name: string;
        contentType?: string;
        size?: number;
      }>,
    ) => {
      const trimmed = text.trim();
      const hasAttachments = !!(attachments && attachments.length > 0);
      // Allow sending if there's text OR attachments — operator can
      // attach a file without typing anything (e.g. "summarize this").
      if (
        (!trimmed && !hasAttachments) ||
        sending ||
        !conversationId
      ) {
        return;
      }
      if (active) return; // a turn is already running on this conversation
      setSending(true);
      setSendError(null);
      try {
        const res = await fetch("/api/agent/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            text: trimmed || "(see attached files)",
            attachments,
          }),
        });
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(
            (detail as { error?: string }).error ??
              `Agent route failed: ${res.status}`,
          );
        }
        // Don't need the response — Convex reactive query picks up the
        // newly-created agent_turns + agent_messages rows in <200ms.
      } catch (err) {
        setSendError(err instanceof Error ? err.message : "Send failed.");
      } finally {
        setSending(false);
      }
    },
    [conversationId, sending, active],
  );

  // Stop = POST /api/agent/cancel with the active turn id. The wrapper
  // sees `agent_turns.status = "canceled"` (via its own poll or the
  // direct cancel HTTP) and aborts its asyncio task. The reactive
  // query flips the UI to idle.
  const stop = useCallback(async () => {
    if (!active) return;
    try {
      await fetch("/api/agent/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turnId: active.turn._id,
        }),
      });
    } catch (err) {
      console.error("[chat] cancel failed:", err);
    }
  }, [active]);

  // Regenerate = re-run the latest assistant turn for the conversation.
  // Server deletes the old assistant message + chunks + tool events,
  // creates a fresh queued turn pointing at the same user message, and
  // kicks Railway off again — so the agent re-answers with the same
  // memory but a different sampling.
  const [regenerating, setRegenerating] = useState(false);
  const regenerate = useCallback(async () => {
    if (regenerating || !conversationId || active) return;
    setRegenerating(true);
    setSendError(null);
    try {
      const res = await fetch("/api/agent/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(
          (detail as { error?: string }).error ??
            `Regenerate route failed: ${res.status}`,
        );
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Regenerate failed.");
    } finally {
      setRegenerating(false);
    }
  }, [conversationId, regenerating, active]);

  return {
    messages,
    status,
    error,
    sendMessage,
    stop,
    regenerate,
    canRegenerate: !active && messages.some((m) => m.role === "assistant"),
    thought,
    tools,
  };
}
