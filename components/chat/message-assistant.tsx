"use client";

// MessageAssistant — renders one assistant turn.
// Integrates ChatMarkdown + NarrationRibbon (U3) + ToolResult per tool (U4).
// For COMPLETED messages (streaming=false), renders the NarrationFooter.
// For STREAMING messages, renders the NarrationRibbon in compact mode once
// text is flowing, or full mode while thinking/running tools.

import { useEffect, useRef, useState } from "react";
import { ChatMarkdown } from "@/components/chat-markdown";
import { NarrationFooter, NarrationRibbon } from "@/components/chat/narration-ribbon";
import { ToolResult } from "@/components/chat/tool-result";
import { HistoricalToolResults } from "@/components/chat/historical-tool-results";
import type { ChatMessage, ToolActivity } from "@/lib/use-hermes-chat";

type Props = {
  message: ChatMessage;
  /** Tools are only passed when this is the currently-streaming message. */
  streamingTools?: ToolActivity[];
  thought?: string;
  status: "idle" | "streaming" | "error";
  /** Index of this message, used to compute turnsAgo for tool result collapse. */
  totalMessages: number;
  messageIndex: number;
  isLastAssistant: boolean;
  canRegenerate: boolean;
  onRegenerate: () => void;
  children?: React.ReactNode; // action cards / connect CTAs passed in
};

function Timestamp({ iso, className }: { iso: string; className?: string }) {
  const [label, setLabel] = useState(() => relativeTime(iso));
  useEffect(() => {
    const id = setInterval(() => setLabel(relativeTime(iso)), 60_000);
    return () => clearInterval(id);
  }, [iso]);
  const absolute = new Date(iso).toLocaleString();
  return (
    <time dateTime={iso} title={absolute} className={`text-[10.5px] text-ink-3 num ${className ?? ""}`}>
      {label}
    </time>
  );
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  if (!text.trim()) return null;
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard denied */ }
      }}
      className="text-[11px] text-ink-3 hover:text-ink"
      aria-label="Copy message"
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}

export function MessageAssistant({
  message,
  streamingTools,
  thought,
  status,
  totalMessages,
  messageIndex,
  isLastAssistant,
  canRegenerate,
  onRegenerate,
  children,
}: Props) {
  const isStreaming = !!message.streaming;
  const hasText = message.text.trim().length > 0;
  // turnsAgo: 0 = this is the latest message, higher = older
  const turnsAgo = totalMessages - 1 - messageIndex;

  // For completed messages that had tools, we need to show the tool results.
  // The tool results are attached to the streaming tools during streaming,
  // but after completion they persist in the message's associated tools array.
  // Since we only get streamingTools for the active turn, completed turns
  // won't have tool data here — that's expected; results shown during streaming
  // are the primary UX, and the NarrationFooter shows tool names.
  const toolsToRender = streamingTools ?? [];

  // Tools that have results to render (only during or right after streaming)
  const toolsWithResults = toolsToRender.filter((t) => t.result !== undefined && t.status !== "running");

  // Ribbon only during streaming
  const showRibbon = isStreaming && status === "streaming";

  // Compact ribbon: after text starts flowing
  const hasStreamingText = isStreaming && hasText;

  const ref = useRef<HTMLDivElement>(null);

  return (
    <div className="group" ref={ref}>
      {/* Narration ribbon — full pre-text or compact alongside text */}
      {showRibbon && (
        <NarrationRibbon
          tools={streamingTools ?? []}
          thought={thought ?? ""}
          hasStreamingText={hasStreamingText}
          status={status}
        />
      )}

      {/* Tool results — live (streaming) inline between ribbon and text */}
      {toolsWithResults.length > 0 && (
        <div className="mb-2 flex flex-col gap-2">
          {toolsWithResults.map((t) => (
            <ToolResult key={t.id} tool={t} turnsAgo={turnsAgo} />
          ))}
        </div>
      )}

      {/* Tool results — persisted for completed turns (re-rendered from
          agent_tool_events so the widgets stay in the response history). */}
      {!isStreaming && message.turnId && toolsWithResults.length === 0 && (
        <HistoricalToolResults turnId={message.turnId} turnsAgo={turnsAgo} />
      )}

      {/* Assistant text */}
      {hasText && (
        <ChatMarkdown streaming={isStreaming}>{message.text}</ChatMarkdown>
      )}

      {/* Completed: narration footer (shows which tools ran) */}
      {!isStreaming && toolsToRender.length > 0 && (
        <NarrationFooter tools={toolsToRender} />
      )}

      {/* Hover actions row */}
      <div className="mt-1 flex items-center gap-3 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <Timestamp iso={message.createdAt} />
        {isLastAssistant && !isStreaming && canRegenerate && (
          <button
            onClick={onRegenerate}
            className="text-[11px] text-ink-3 hover:text-ink underline underline-offset-2 decoration-line"
          >
            regenerate
          </button>
        )}
        <CopyButton text={message.text} />
      </div>

      {/* Action cards / connect CTAs */}
      {children && (
        <div className="mt-2 flex flex-col gap-1.5">
          {children}
        </div>
      )}
    </div>
  );
}
