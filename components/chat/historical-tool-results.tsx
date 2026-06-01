"use client";

// Re-renders a completed turn's tool-result widgets in the transcript history.
// Live streaming shows tool results from the active turn's events; once the
// turn completes those go away, leaving only text. This reconstructs the same
// ToolActivity[] from the persisted agent_tool_events so the severity cards /
// tables stay in the response permanently.

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ToolResult } from "@/components/chat/tool-result";
import type { ToolActivity } from "@/lib/use-hermes-chat";

export function HistoricalToolResults({
  turnId,
  turnsAgo,
}: {
  turnId: string;
  turnsAgo: number;
}) {
  const events = useQuery(api.agentToolEvents.forTurn, {
    turn_id: turnId as never,
  }) as
    | Array<{ kind: string; tool_call_id?: string; name?: string; ok?: boolean; result_json?: string; seq: number }>
    | undefined;

  if (!events || events.length === 0) return null;

  const byId = new Map<string, ToolActivity>();
  for (const ev of [...events].sort((a, b) => a.seq - b.seq)) {
    if (!ev.tool_call_id) continue;
    const prev = byId.get(ev.tool_call_id);
    if (ev.kind === "tool_start") {
      byId.set(ev.tool_call_id, {
        id: ev.tool_call_id,
        name: ev.name ?? "tool",
        status: "done",
        startedAt: 0,
      });
    } else if (ev.kind === "tool_end") {
      if (prev) prev.status = ev.ok === false ? "error" : "done";
    } else if (ev.kind === "tool_result") {
      const t: ToolActivity =
        prev ?? { id: ev.tool_call_id, name: ev.name ?? "tool", status: "done", startedAt: 0 };
      if (ev.name) t.name = ev.name;
      try {
        t.result = ev.result_json ? JSON.parse(ev.result_json) : undefined;
      } catch {
        /* leave result undefined → renderer falls back */
      }
      byId.set(ev.tool_call_id, t);
    }
  }

  const tools = [...byId.values()].filter((t) => t.result !== undefined);
  if (tools.length === 0) return null;

  return (
    <div className="mb-2 flex flex-col gap-2">
      {tools.map((t) => (
        <ToolResult key={t.id} tool={t} turnsAgo={turnsAgo} />
      ))}
    </div>
  );
}
