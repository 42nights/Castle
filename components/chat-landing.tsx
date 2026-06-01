"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  cancelPendingConnections,
  initiateConnection,
} from "@/app/connections/actions";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useChatContext } from "@/lib/chat-context";
import { useChatDraft } from "@/lib/use-chat-draft";
import type { ToolActivity } from "@/lib/use-hermes-chat";
import { ChatSidebar } from "@/components/chat-sidebar";
import { ConnectionsRail } from "@/components/connections-rail";
import { DotLoader } from "@/components/ui/dot-loader";
import { ActionCard } from "@/components/chat/action-card";
import { Composer } from "@/components/chat/composer";
import { EmptyState } from "@/components/chat/empty-state";
import { MessageAssistant } from "@/components/chat/message-assistant";

// Keep the scanning dot-grid animation for the legacy Thinking component
// (shown when streaming but no text yet) — preserved from original.
const THINKING_FRAMES: number[][] = [
  [9, 16, 17, 15, 23],
  [10, 17, 18, 16, 24],
  [11, 18, 19, 17, 25],
  [18, 25, 26, 24, 32],
  [25, 32, 33, 31, 39],
  [32, 39, 40, 38, 46],
  [31, 38, 39, 37, 45],
  [30, 37, 38, 36, 44],
  [23, 30, 31, 29, 37],
  [31, 29, 37, 22, 24, 23, 38, 36],
  [16, 23, 24, 22, 30],
];

const FALLBACK_SUGGESTIONS = [
  "what's red right now?",
  "list FDEs and their utilization",
  "what did i ask you to remember last time?",
  "summarize today across all engagements",
  "remember: jerry prefers terse one-line answers",
];

function useNowBucket() {
  const [b, setB] = useState(() => Math.floor(Date.now() / 60_000));
  useEffect(() => {
    const id = setInterval(() => setB(Math.floor(Date.now() / 60_000)), 60_000);
    return () => clearInterval(id);
  }, []);
  return b;
}

/**
 * Castle chat landing. Three-column layout:
 *   ChatSidebar (220) · chat (flex) · ConnectionsRail (240)
 *
 * Orchestrates: ChatSidebar, Composer, EmptyState, message list (with
 * MessageAssistant for NarrationRibbon + ToolResult), ActionCard for
 * propose_mutation, ConnectCta for composio_connect.
 *
 * Chat stream state lives in ChatProvider (app/layout.tsx) so it
 * survives navigation.
 */
export function ChatLanding() {
  const {
    actorSlug,
    conversationId,
    setConversationId,
    messages,
    status,
    error,
    sendMessage,
    stop,
    regenerate,
    canRegenerate,
    thought,
    tools,
  } = useChatContext();

  const tailRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stuckToBottom, setStuckToBottom] = useState(true);
  const STICKY_THRESHOLD_PX = 80;

  const clearTranscript = useMutation(api.agentMessages.clear);

  // Full action row shape from Convex — covers both composio_connect and
  // propose_mutation. Cast is needed because the generated types don't yet
  // include the new propose_mutation fields (frozen schema, other agent's side).
  type FullActionRow = {
    _id: Id<"agent_actions">;
    kind: "composio_connect" | "propose_mutation";
    toolkit: string;
    url: string;
    created_at: string;
    dismissed_at: string | null;
    tool_name?: string;
    verb?: string;
    target?: string;
    reason?: string;
    side_effects?: string[];
    payload_json?: string;
    expires_at?: string;
    resolved_outcome?: "accepted" | "rejected" | "dismissed" | "expired";
    resolved_at?: string;
    undo_until?: string;
    result_json?: string;
  };

  const proposed = useQuery(
    api.agentActions.listOpen,
    actorSlug ? { actor_slug: actorSlug } : "skip",
  ) as FullActionRow[] | undefined;

  const dismissAction = useMutation(api.agentActions.dismiss);
  const [draft, setDraft, clearDraft] = useChatDraft(conversationId ?? null);

  const nowBucket = useNowBucket();
  const rotationBucket = Math.floor(Date.now() / 86_400_000);
  const mountSeedRef = useRef(Math.floor(Math.random() * 1e9));
  const dynamicSuggestions = useQuery(api.suggestions.list, {
    nowBucket,
    rotationBucket,
    mountSeed: mountSeedRef.current,
  }) as Array<{ id: string; prompt: string }> | undefined;
  const suggestions =
    (dynamicSuggestions ?? []).length > 0
      ? (dynamicSuggestions as Array<{ id: string; prompt: string }>).map((s) => s.prompt)
      : FALLBACK_SUGGESTIONS;

  useEffect(() => {
    if (!stuckToBottom) return;
    tailRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, status, stuckToBottom]);

  const ctaTopId = proposed?.[0]?._id ?? null;
  useEffect(() => {
    if (!ctaTopId) return;
    tailRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    setStuckToBottom(true);
  }, [ctaTopId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setStuckToBottom(distance < STICKY_THRESHOLD_PX);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [conversationId]);

  const jumpToLatest = () => {
    setStuckToBottom(true);
    tailRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  const onClear = async () => {
    if (!conversationId) return;
    if (!confirm("Clear this chat's visible transcript? Hermes' own session memory is untouched.")) return;
    try {
      await clearTranscript({ conversation_id: conversationId });
      toast.success("Transcript cleared.");
    } catch {
      toast.error("Could not clear transcript.");
    }
  };

  const empty = messages.length === 0;

  return (
    <div className="flex" style={{ height: "calc(100vh - 56px)" }}>
      <ChatSidebar
        actorSlug={actorSlug}
        selectedId={conversationId}
        onSelect={setConversationId}
      />
      <div className="flex-1 flex flex-col min-w-0">
        {conversationId ? <ChatHeader conversationId={conversationId} /> : null}
        <div ref={scrollRef} className="relative flex-1 min-h-0 overflow-y-auto">
          {!stuckToBottom && (
            <div className="sticky bottom-3 z-10 flex justify-center pointer-events-none">
              <button
                onClick={jumpToLatest}
                className="pointer-events-auto h-7 px-3 rounded-full border border-line bg-page shadow-sm text-[11.5px] text-ink hover:bg-surface inline-flex items-center gap-1.5"
              >
                ↓ jump to latest
              </button>
            </div>
          )}
          <div className="mx-auto max-w-[720px] px-6 pt-8 pb-10">
            {empty ? (
              <EmptyState suggestions={suggestions} onPick={(s) => setDraft(s)} />
            ) : (
              <div className="flex flex-col gap-4">
                {(() => {
                  // Same gating logic as original: per-action freshness check,
                  // last-assistant-must-belong-to-current-turn guard.
                  const visible = messages.filter((m) => !(m.streaming && m.text === ""));
                  const open = proposed ?? [];
                  let lastAssistantIdx = -1;
                  let lastUserIdx = -1;
                  for (let i = visible.length - 1; i >= 0; i--) {
                    if (lastAssistantIdx < 0 && visible[i].role === "assistant") lastAssistantIdx = i;
                    if (lastUserIdx < 0 && visible[i].role === "user") lastUserIdx = i;
                    if (lastAssistantIdx >= 0 && lastUserIdx >= 0) break;
                  }
                  const lastUser = lastUserIdx >= 0 ? visible[lastUserIdx] : null;
                  const lastAssistant = lastAssistantIdx >= 0 ? visible[lastAssistantIdx] : null;
                  const lastUserAt = lastUser?.createdAt ?? null;
                  const assistantIsCurrentTurn =
                    lastAssistant !== null &&
                    lastUserAt !== null &&
                    lastAssistant.createdAt >= lastUserAt;
                  const freshActions = lastUserAt
                    ? open.filter((a) => a.created_at > lastUserAt)
                    : [];
                  const showCtas = assistantIsCurrentTurn && freshActions.length > 0;

                  return visible.map((m, i) => {
                    const attached = showCtas && i === lastAssistantIdx ? freshActions : [];

                    if (m.role === "user") {
                      return (
                        <div key={m.id} className="group flex justify-end">
                          <div className="flex flex-col items-end gap-1.5 max-w-[80%]">
                            {m.text && (
                              <div className="rounded-sm bg-ink text-page px-2.5 py-1.5 text-[13.5px] leading-snug whitespace-pre-wrap relative">
                                {m.text}
                                <UserTimestamp iso={m.createdAt} />
                              </div>
                            )}
                            {m.attachments && m.attachments.length > 0 && (
                              <div className="flex flex-wrap justify-end gap-1.5">
                                {m.attachments.map((a) => (
                                  <AttachmentChip key={a.storageId} attachment={a} />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // assistant turn — the last assistant during streaming gets live tools
                    const isThisStreamingTurn =
                      i === lastAssistantIdx && status === "streaming";

                    return (
                      <MessageAssistant
                        key={m.id}
                        message={m}
                        streamingTools={isThisStreamingTurn ? tools : undefined}
                        thought={isThisStreamingTurn ? thought : undefined}
                        status={status}
                        totalMessages={visible.length}
                        messageIndex={i}
                        isLastAssistant={i === lastAssistantIdx}
                        canRegenerate={canRegenerate}
                        onRegenerate={regenerate}
                      >
                        {/* Render attached actions under this assistant turn */}
                        {attached.map((a) =>
                          a.kind === "propose_mutation" ? (
                            <ActionCard
                              key={a._id}
                              action={a}
                              onDismiss={(id) => dismissAction({ id })}
                            />
                          ) : (
                            <ConnectCta
                              key={a._id}
                              toolkit={a.toolkit}
                              url={a.url}
                              actorSlug={actorSlug}
                              onDismiss={() => dismissAction({ id: a._id })}
                            />
                          ),
                        )}
                      </MessageAssistant>
                    );
                  });
                })()}

                {/* Thinking indicator: shown while streaming but NO text has arrived yet
                    AND NarrationRibbon (inside MessageAssistant) hasn't taken over.
                    NarrationRibbon handles its own pre-text state, so this only fires
                    when there are zero visible assistant rows yet. */}
                {status === "streaming" &&
                  messages.filter((m) => !(m.streaming && m.text === "")).every((m) => m.role === "user") && (
                  <Thinking
                    key={messages.length}
                    tools={tools}
                    thought={thought}
                    compact={false}
                  />
                )}

                {error && (
                  <div className="text-accent text-[12.5px]">{error}</div>
                )}
                <div ref={tailRef} />
              </div>
            )}
          </div>
        </div>

        <Composer
          draft={draft}
          setDraft={setDraft}
          clearDraft={clearDraft}
          conversationId={conversationId}
          actorSlug={actorSlug}
          status={status}
          hasMessages={messages.length > 0}
          onSend={sendMessage}
          onStop={stop}
          onClear={onClear}
        />
      </div>
      <ConnectionsRail />
    </div>
  );
}

// ─── ChatHeader ───────────────────────────────────────────────────────────────

function ChatHeader({ conversationId }: { conversationId: Id<"agent_conversations"> }) {
  const { isAuthenticated } = useConvexAuth();
  const personal = useQuery(
    api.agentMessages.listPersonal,
    isAuthenticated ? {} : "skip",
  ) as Array<{ _id: Id<"agent_conversations">; visibility?: "personal" | "shared" }> | undefined;
  const shared = useQuery(
    api.agentMessages.listShared,
    isAuthenticated ? {} : "skip",
  ) as Array<{ _id: Id<"agent_conversations">; visibility?: "personal" | "shared" }> | undefined;
  const setVisibility = useMutation(api.agentMessages.setVisibility);
  const all = [...(personal ?? []), ...(shared ?? [])];
  const me = all.find((c) => c._id === conversationId);
  if (!me) return null;
  const visibility = me.visibility ?? "personal";

  const flip = async () => {
    const target = visibility === "personal" ? "shared" : "personal";
    const blurb =
      target === "shared"
        ? "Make this chat shared? Any teammate on the allowlist will be able to read and post here, and a fresh Hermes memory store will be created — prior memory in this thread won't carry over."
        : "Make this chat personal again? It'll only be visible to you, and a fresh Hermes memory store will be created — prior memory in this thread won't carry over.";
    if (!confirm(blurb)) return;
    try {
      await setVisibility({ id: conversationId, visibility: target });
      toast.success(target === "shared" ? "Chat is now shared." : "Chat is now personal.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change visibility.");
    }
  };

  return (
    <div className="shrink-0 border-b border-line bg-page">
      <div className="mx-auto max-w-[720px] px-6 py-2 flex items-center justify-between gap-3">
        <span className={`text-[10.5px] uppercase tracking-wider num inline-flex items-center gap-1.5 ${visibility === "shared" ? "text-ink" : "text-ink-3"}`}>
          <span className={`inline-block size-1.5 rounded-full ${visibility === "shared" ? "bg-ink" : "bg-ink-3"}`} />
          {visibility}
        </span>
        <button
          onClick={flip}
          className="text-[11.5px] text-ink-3 hover:text-ink underline underline-offset-2 decoration-line"
        >
          {visibility === "personal" ? "make shared" : "make personal"}
        </button>
      </div>
    </div>
  );
}

// ─── User message helpers ─────────────────────────────────────────────────────

function UserTimestamp({ iso }: { iso: string }) {
  const [label, setLabel] = useState(() => relativeTime(iso));
  useEffect(() => {
    const id = setInterval(() => setLabel(relativeTime(iso)), 60_000);
    return () => clearInterval(id);
  }, [iso]);
  const absolute = new Date(iso).toLocaleString();
  return (
    <time
      dateTime={iso}
      title={absolute}
      className="absolute -bottom-4 right-1 text-[10.5px] text-ink-3 num"
    >
      {label}
    </time>
  );
}

function AttachmentChip({ attachment }: { attachment: { storageId: string; name: string; size?: number } }) {
  const url = useQuery(api.agentMessages.attachmentUrl, {
    storageId: attachment.storageId as Id<"_storage">,
  }) as string | null | undefined;
  return (
    <a
      href={url ?? "#"}
      onClick={(e) => { if (!url) e.preventDefault(); }}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 h-6 px-2 rounded-sm border border-line bg-page text-[11.5px] text-ink hover:bg-surface"
      title={attachment.size ? `${attachment.name} · ${Math.round(attachment.size / 1024)} KB` : attachment.name}
    >
      <span className="text-ink-3">📎</span>
      <span className="truncate max-w-[180px]">{attachment.name}</span>
    </a>
  );
}

// ─── ConnectCta (composio_connect) ───────────────────────────────────────────

function ConnectCta({
  toolkit,
  url,
  actorSlug,
  onDismiss,
}: {
  toolkit: string;
  url: string;
  actorSlug: string | null;
  onDismiss: () => void;
}) {
  const [regenerating, setRegenerating] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const regenerate = async () => {
    if (!actorSlug || regenerating) return;
    setRegenerating(true);
    try {
      const res = await initiateConnection(toolkit, actorSlug);
      if ("error" in res) { toast.error(res.error); return; }
      if (!res.redirectUrl) { toast.error("Composio returned no URL."); return; }
      window.location.href = res.redirectUrl;
    } finally {
      setRegenerating(false);
    }
  };

  const dismiss = async () => {
    if (dismissing) return;
    setDismissing(true);
    if (actorSlug) {
      try { await cancelPendingConnections(toolkit, actorSlug); } catch { /* non-fatal */ }
    }
    onDismiss();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("castle:connections-changed"));
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 text-[12.5px]">
      <div className="inline-flex items-center gap-2 min-w-0 text-ink-3">
        <a href={url} className="h-7 px-3 rounded-sm bg-ink text-page inline-flex items-center hover:opacity-90">
          connect {toolkit} →
        </a>
        <button
          onClick={regenerate}
          disabled={regenerating}
          className="text-ink-3 hover:text-ink underline underline-offset-2 decoration-line"
        >
          {regenerating ? "regenerating…" : "regenerate"}
        </button>
        <button
          onClick={dismiss}
          disabled={dismissing}
          className="text-ink-3 hover:text-ink disabled:opacity-50"
        >
          {dismissing ? "dismissing…" : "dismiss"}
        </button>
      </div>
    </div>
  );
}

// ─── Thinking (legacy fallback — shown only before any assistant row exists) ─

function Thinking({
  tools = [],
  thought = "",
  compact = false,
}: {
  tools?: ToolActivity[];
  thought?: string;
  compact?: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const recent = tools.slice(-3);
  const lastThoughtLine = thought.trim().split("\n").filter(Boolean).slice(-1)[0];
  const runningToolName = tools.find((t) => t.status === "running")?.name;

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-0.5 py-1 text-[11.5px] text-ink-3 num">
        <DotLoader frames={THINKING_FRAMES} duration={140} repeatCount={-1} className="gap-px" dotClassName="size-[3px] rounded-[1px] bg-ink/15 [&.active]:bg-ink" />
        <span>
          {runningToolName ? (
            <>
              <span className="text-ink-2">⚡ {runningToolName}</span>
              <span className="text-ink-3"> · {elapsed}s</span>
            </>
          ) : (
            <>working · {elapsed}s</>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 px-0.5 py-1 text-[12px] text-ink-3">
      <div className="flex items-center gap-2.5">
        <DotLoader frames={THINKING_FRAMES} duration={140} repeatCount={-1} className="gap-px" dotClassName="size-[3px] rounded-[1px] bg-ink/15 [&.active]:bg-ink" />
        <span className="num">thinking{elapsed > 0 ? ` · ${elapsed}s` : "…"}</span>
      </div>
      {recent.length > 0 && (
        <div className="flex flex-col gap-0.5 pl-4">
          {recent.map((t) => (
            <span key={t.id} className="num text-[11.5px]">
              <span className="text-ink-2">⚡</span>{" "}
              <span className={t.status === "error" ? "text-accent" : ""}>{t.name}</span>
              {t.status === "running" ? (
                <span className="text-ink-3">…</span>
              ) : t.durationMs ? (
                <span className="text-ink-3"> · {(t.durationMs / 1000).toFixed(1)}s</span>
              ) : null}
            </span>
          ))}
        </div>
      )}
      {lastThoughtLine && (
        <div className="pl-4 italic text-ink-3/80 line-clamp-1">{lastThoughtLine}</div>
      )}
    </div>
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
