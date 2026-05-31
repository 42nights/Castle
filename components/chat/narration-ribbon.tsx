"use client";

// NarrationRibbon — U3
// Breathing dot + friendly label during streaming. States:
//   thinking   → pulsing accent dot + "Thinking…"
//   running    → amber dot + "Reading <friendly tool name>…"
//   done       → green dot + tool summary footer (compact, persists)
//   streaming  → ink-3 dot + compact inline row
// No layout shift: fixed min-height, transitions via opacity/width.

import { useEffect, useRef, useState } from "react";
import type { ToolActivity } from "@/lib/use-hermes-chat";

// Map raw tool names to operator-friendly labels
const TOOL_LABELS: Record<string, string> = {
  list_attention: "attention queue",
  list_customers: "customer list",
  list_engagements: "engagements",
  list_fdes: "FDE roster",
  list_templates: "template library",
  list_deployments: "deployments",
  engagement_mark_touched: "engagement log",
  attention_snooze: "attention queue",
  attention_resolve: "attention queue",
  get_customer: "customer record",
  get_engagement: "engagement record",
  get_fde: "FDE record",
};

function friendlyName(raw: string): string {
  const key = raw.replace(/^castle[._]/i, "").toLowerCase();
  return TOOL_LABELS[key] ?? key.replace(/_/g, " ");
}

type Props = {
  tools: ToolActivity[];
  /** Reserved for future thought preview — not yet rendered. */
  thought?: string;
  /** True once any assistant text is streaming — switches to compact mode. */
  hasStreamingText: boolean;
  /** Status of the turn. */
  status: "idle" | "streaming" | "error";
};

export function NarrationRibbon({ tools, hasStreamingText, status }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  // Reset elapsed when a new turn starts. setElapsed(0) fires only on
  // status transition so it won't cause cascading renders.
  useEffect(() => {
    if (status !== "streaming") return;
    startRef.current = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => {
      clearInterval(id);
      setElapsed(0);
    };
  }, [status]);

  const runningTool = tools.find((t) => t.status === "running");
  const doneTool = tools.length > 0 && !runningTool ? tools[tools.length - 1] : null;

  // Dot state
  let dotColor = "bg-[var(--color-ribbon-thinking)]";
  let dotAnimate = "animate-pulse";
  if (runningTool) {
    dotColor = "bg-[var(--color-ribbon-running)]";
    dotAnimate = "animate-pulse";
  } else if (hasStreamingText) {
    dotColor = "bg-ink-3";
    dotAnimate = "";
  }

  const label = (() => {
    if (runningTool) return `Reading ${friendlyName(runningTool.name)}…`;
    if (hasStreamingText && tools.length === 0) return `thinking · ${elapsed}s`;
    if (hasStreamingText) return null; // no label once streaming started with tools
    return `thinking · ${elapsed}s`;
  })();

  // Compact mode — shown alongside streamed text
  if (hasStreamingText) {
    if (!runningTool && tools.length === 0) return null; // no ribbon needed
    return (
      <div
        className="flex items-center gap-1.5 py-0.5 text-[11px] text-ink-3 num"
        aria-live="polite"
        aria-label={runningTool ? `Reading ${friendlyName(runningTool.name)}` : undefined}
      >
        <span
          className={`inline-block size-1.5 rounded-full shrink-0 ${dotColor} ${dotAnimate}`}
          aria-hidden
        />
        {runningTool && (
          <span>
            <span className="text-ink-2">{friendlyName(runningTool.name)}</span>
            {" · "}{elapsed}s
          </span>
        )}
        {!runningTool && doneTool && (
          <span className="text-ink-3">
            {tools.map((t) => friendlyName(t.name)).join(" · ")}
          </span>
        )}
      </div>
    );
  }

  // Full mode — pre-text, thinking or running a tool
  return (
    <div
      className="flex flex-col gap-1 py-1 text-[12px] text-ink-3"
      aria-live="polite"
      aria-label={label ?? undefined}
    >
      <div className="flex items-center gap-2">
        <span
          className={`inline-block size-2 rounded-full shrink-0 ${dotColor} ${dotAnimate}`}
          aria-hidden
        />
        <span className="num">
          {label ?? `working · ${elapsed}s`}
        </span>
      </div>
      {tools.length > 0 && (
        <div className="flex flex-col gap-0.5 pl-4">
          {tools.slice(-3).map((t) => (
            <span key={t.id} className="num text-[11px] flex items-center gap-1.5">
              <span
                className={`inline-block size-1 rounded-full shrink-0 ${
                  t.status === "running"
                    ? "bg-[var(--color-ribbon-running)] animate-pulse"
                    : t.status === "error"
                    ? "bg-[var(--color-ribbon-error)]"
                    : "bg-[var(--color-ribbon-done)]"
                }`}
                aria-hidden
              />
              <span className={t.status === "error" ? "text-accent" : "text-ink-2"}>
                {friendlyName(t.name)}
              </span>
              {t.status === "running" ? (
                <span className="text-ink-3">…</span>
              ) : t.durationMs ? (
                <span className="text-ink-3">
                  {(t.durationMs / 1000).toFixed(1)}s
                </span>
              ) : null}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Compact footer shown AFTER a turn completes — persists to show which
// tools ran. Only shows if any tools actually ran.
export function NarrationFooter({ tools }: { tools: ToolActivity[] }) {
  if (tools.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-ink-3 num">
      {tools.map((t, i) => (
        <span key={t.id} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-ink-3 opacity-40">·</span>}
          <span
            className={`inline-block size-1 rounded-full shrink-0 ${
              t.status === "error"
                ? "bg-[var(--color-ribbon-error)]"
                : "bg-[var(--color-ribbon-done)]"
            }`}
            aria-hidden
          />
          <span>{friendlyName(t.name)}</span>
          {t.durationMs && (
            <span className="opacity-50">{(t.durationMs / 1000).toFixed(1)}s</span>
          )}
        </span>
      ))}
    </div>
  );
}
