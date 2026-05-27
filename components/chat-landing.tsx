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
import { type ChatMessage, type ToolActivity } from "@/lib/use-hermes-chat";
import { ChatMarkdown } from "@/components/chat-markdown";
import { ChatSidebar } from "@/components/chat-sidebar";
import { ConnectionsRail } from "@/components/connections-rail";
import { DotLoader } from "@/components/ui/dot-loader";

// Searching-style scan around a 7x7 dot grid. Used as the "thinking"
// indicator — the agent is hunting for context before any text arrives.
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

/** Fallback list rendered if `api.suggestions.list` hasn't responded yet
 *  (transient) or errors out (degraded). Same shape Hermes can answer;
 *  the dynamic query just replaces these with state-aware variants. */
const FALLBACK_SUGGESTIONS = [
  "what's red right now?",
  "list FDEs and their utilization",
  "what did i ask you to remember last time?",
  "summarize today across all engagements",
  "remember: jerry prefers terse one-line answers",
];

/**
 * Per-minute ticker for the suggestions reactive query — matches the
 * pattern in components/sections/attention-live.tsx. Causes Convex to
 * re-run when state would have shifted (snooze expiry, a red flag
 * appearing, an FDE going overcommitted).
 */
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
 * Each conversation in the sidebar has its own Hermes session, so
 * memory is per-thread. Pick an existing chat from the rail or hit
 * `+ new` to start fresh.
 */
export function ChatLanding() {
  // Chat state lives in a provider at app/layout.tsx so it survives
  // navigation. Without that hoist, leaving `/` mid-stream wiped the
  // thinking dots + tool activity + streaming text until the assistant
  // turn finally landed in Convex history.
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tailRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Sticky-bottom: only auto-scroll on new content if the user is
  // already near the bottom. Re-engaged via the "jump to latest" pill.
  const [stuckToBottom, setStuckToBottom] = useState(true);
  const STICKY_THRESHOLD_PX = 80;
  const clearTranscript = useMutation(api.agentMessages.clear);
  const proposed = useQuery(
    api.agentActions.listOpen,
    actorSlug ? { actor_slug: actorSlug } : "skip",
  ) as
    | Array<{
        _id: Id<"agent_actions">;
        toolkit: string;
        url: string;
        created_at: string;
      }>
    | undefined;
  const dismissAction = useMutation(api.agentActions.dismiss);
  const [draft, setDraft, clearDraft] = useChatDraft(conversationId ?? null);

  // Dynamic suggestions for the empty state. Three cadences stack:
  //   nowBucket      — reactive within ~60s of state changes
  //   rotationBucket — daily variety axis (same operator, different day,
  //                    different ordering, even with the same state)
  //   mountSeed      — stable within a single mount; refreshes on
  //                    conversation switch (re-runs the ref initializer
  //                    via the key). UX freebie: "give me different
  //                    suggestions" = click a chat and back.
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
      ? (dynamicSuggestions as Array<{ id: string; prompt: string }>).map(
          (s) => s.prompt,
        )
      : FALLBACK_SUGGESTIONS;

  // Focus the input when the user switches conversations. Draft
  // hydration is handled inside useChatDraft (per-conversation
  // localStorage key) so a switch restores the unsent text instead of
  // wiping it.
  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationId]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(
        inputRef.current.scrollHeight,
        200,
      )}px`;
    }
  }, [draft]);

  useEffect(() => {
    if (!stuckToBottom) return;
    tailRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, status, stuckToBottom]);

  // One-shot scroll when a new connect CTA lands — overrides the sticky
  // guard so the operator never misses the button. Keyed on the latest
  // open action id so re-renders don't re-scroll repeatedly.
  const ctaTopId = proposed?.[0]?._id ?? null;
  useEffect(() => {
    if (!ctaTopId) return;
    tailRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    setStuckToBottom(true);
  }, [ctaTopId]);

  // Track whether the user is near the bottom. When they scroll up
  // we drop stuckToBottom so streaming text doesn't fight them; the
  // "jump to latest" pill lets them re-engage on demand.
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

  // Pending attachments staged in the composer before send. Uploaded
  // to Convex storage on file-pick; rendered as chips above the
  // textarea. Cleared on send.
  type StagedAttachment = {
    storageId: string;
    name: string;
    contentType?: string;
    size?: number;
  };
  const [pendingAttachments, setPendingAttachments] = useState<
    StagedAttachment[]
  >([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generateUploadUrl = useMutation(
    api.agentMessages.generateAttachmentUploadUrl,
  );

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingCount((n) => n + files.length);
    const uploaded: StagedAttachment[] = [];
    for (const file of Array.from(files)) {
      try {
        const url = await generateUploadUrl({});
        const res = await fetch(url, {
          method: "POST",
          headers: file.type ? { "Content-Type": file.type } : undefined,
          body: file,
        });
        if (!res.ok) throw new Error(`upload ${res.status}`);
        const { storageId } = (await res.json()) as { storageId: string };
        uploaded.push({
          storageId,
          name: file.name,
          contentType: file.type || undefined,
          size: file.size,
        });
      } catch (err) {
        toast.error(
          `Couldn't upload ${file.name}: ${
            err instanceof Error ? err.message : "unknown"
          }`,
        );
      }
    }
    setUploadingCount((n) => Math.max(0, n - files.length));
    if (uploaded.length > 0) {
      setPendingAttachments((prev) => [...prev, ...uploaded]);
    }
  };

  const removeAttachment = (storageId: string) => {
    setPendingAttachments((prev) =>
      prev.filter((a) => a.storageId !== storageId),
    );
  };

  const submit = () => {
    const text = draft.trim();
    if ((!text && pendingAttachments.length === 0) || status === "streaming" || uploadingCount > 0) {
      return;
    }
    sendMessage(
      text,
      pendingAttachments.length ? pendingAttachments : undefined,
    );
    clearDraft();
    setPendingAttachments([]);
  };

  const onClear = async () => {
    if (!conversationId) return;
    if (
      !confirm(
        "Clear this chat's visible transcript? Hermes' own session memory is untouched.",
      )
    )
      return;
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
        <div
          ref={scrollRef}
          className="relative flex-1 min-h-0 overflow-y-auto"
        >
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
              <EmptyState
                suggestions={suggestions}
                onPick={(s) => setDraft(s)}
              />
            ) : (
              <div className="flex flex-col gap-4">
                {(() => {
                  // Render messages. Attach pending CTAs to the latest
                  // assistant message ONLY IF that message was created
                  // *after* the agent_action — otherwise the CTA would
                  // dangle below the previous assistant message until
                  // the new streaming response renders, then jump down
                  // (the "connect button pop" bug). Holding the CTA
                  // back until the new assistant turn exists means the
                  // button lands directly under the message that
                  // proposed it.
                  const visible = messages.filter(
                    (m) => !(m.streaming && m.text === ""),
                  );
                  const open = proposed ?? [];
                  let lastAssistantIdx = -1;
                  for (let i = visible.length - 1; i >= 0; i--) {
                    if (visible[i].role === "assistant") {
                      lastAssistantIdx = i;
                      break;
                    }
                  }
                  const last =
                    lastAssistantIdx >= 0 ? visible[lastAssistantIdx] : null;
                  const earliestAction = open.length
                    ? open.reduce(
                        (min, a) => (a.created_at < min ? a.created_at : min),
                        open[0].created_at,
                      )
                    : null;
                  const showCtas =
                    last !== null &&
                    earliestAction !== null &&
                    last.createdAt >= earliestAction;
                  return visible.map((m, i) => {
                    const attached =
                      showCtas && i === lastAssistantIdx ? open : [];
                    return (
                      <Turn
                        key={m.id}
                        message={m}
                        actions={attached.length > 0 ? attached : null}
                        actorSlug={actorSlug}
                        isLastAssistant={i === lastAssistantIdx}
                        canRegenerate={canRegenerate}
                        onRegenerate={regenerate}
                        onDismissAction={(id) => dismissAction({ id })}
                      />
                    );
                  });
                })()}
                {status === "streaming" && (
                  <Thinking
                    key={messages.length}
                    tools={tools}
                    thought={thought}
                    compact={(messages[messages.length - 1]?.text ?? "") !== ""}
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

        <div className="shrink-0 border-t border-line bg-page">
          <div className="mx-auto max-w-[720px] px-6 py-3">
            <div className="rounded-md border border-line bg-page focus-within:border-ink-2 transition-colors">
              {(pendingAttachments.length > 0 || uploadingCount > 0) && (
                <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2">
                  {pendingAttachments.map((a) => (
                    <span
                      key={a.storageId}
                      className="inline-flex items-center gap-1.5 h-6 pl-2 pr-1 rounded-sm border border-line bg-surface text-[11.5px] text-ink"
                      title={
                        a.size
                          ? `${a.name} · ${Math.round(a.size / 1024)} KB`
                          : a.name
                      }
                    >
                      <span className="truncate max-w-[160px]">{a.name}</span>
                      <button
                        onClick={() => removeAttachment(a.storageId)}
                        className="text-ink-3 hover:text-accent text-[12px] px-0.5"
                        aria-label={`Remove ${a.name}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  {uploadingCount > 0 && (
                    <span className="text-[11px] text-ink-3 num">
                      uploading {uploadingCount}…
                    </span>
                  )}
                </div>
              )}
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder={
                  conversationId
                    ? "Ask Castle anything…"
                    : "Pick or start a chat from the left."
                }
                rows={1}
                disabled={!conversationId}
                className="block w-full resize-none bg-transparent text-[14px] leading-[22px] text-ink placeholder:text-ink-3 outline-none px-3 pt-2.5 pb-1 min-h-[42px] max-h-[200px] disabled:opacity-50"
              />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  onPickFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <div className="flex items-center justify-between px-2 pb-2">
                <span className="text-[11px] text-ink-3 inline-flex items-center gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!conversationId}
                    className="text-ink-3 hover:text-ink disabled:opacity-40"
                    aria-label="Attach files"
                    title="Attach files"
                  >
                    📎
                  </button>
                  <span>
                    castle ·{" "}
                    <span className="text-ink-2">
                      {actorSlug ?? "no actor"}
                    </span>
                  </span>
                  {messages.length > 0 && (
                    <button
                      onClick={onClear}
                      className="text-ink-3 hover:text-accent underline underline-offset-2 decoration-line"
                    >
                      clear
                    </button>
                  )}
                </span>
                {status === "streaming" ? (
                  <button
                    onClick={stop}
                    className="h-7 px-3 rounded-sm border border-line text-[12px] text-ink-2 hover:text-ink"
                  >
                    stop
                  </button>
                ) : (
                  <button
                    onClick={submit}
                    disabled={
                      (!draft.trim() && pendingAttachments.length === 0) ||
                      !conversationId
                    }
                    className="h-7 px-3 rounded-sm bg-ink text-page text-[12px] disabled:opacity-40 inline-flex items-center gap-1.5"
                  >
                    send <kbd className="num text-[10px] opacity-70">⏎</kbd>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <ConnectionsRail />
    </div>
  );
}

function ChatHeader({
  conversationId,
}: {
  conversationId: Id<"agent_conversations">;
}) {
  const { isAuthenticated } = useConvexAuth();
  const personal = useQuery(
    api.agentMessages.listPersonal,
    isAuthenticated ? {} : "skip",
  ) as
    | Array<{
        _id: Id<"agent_conversations">;
        visibility?: "personal" | "shared";
      }>
    | undefined;
  const shared = useQuery(
    api.agentMessages.listShared,
    isAuthenticated ? {} : "skip",
  ) as
    | Array<{
        _id: Id<"agent_conversations">;
        visibility?: "personal" | "shared";
      }>
    | undefined;
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
      toast.success(
        target === "shared" ? "Chat is now shared." : "Chat is now personal.",
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not change visibility.",
      );
    }
  };

  return (
    <div className="shrink-0 border-b border-line bg-page">
      <div className="mx-auto max-w-[720px] px-6 py-2 flex items-center justify-between gap-3">
        <span
          className={`text-[10.5px] uppercase tracking-wider num inline-flex items-center gap-1.5 ${
            visibility === "shared" ? "text-ink" : "text-ink-3"
          }`}
        >
          <span
            className={`inline-block size-1.5 rounded-full ${
              visibility === "shared" ? "bg-ink" : "bg-ink-3"
            }`}
          />
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

function EmptyState({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (s: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-ink">
          What needs handling?
        </h1>
        <p className="mt-1 text-[12.5px] text-ink-3 leading-snug">
          Each chat in the left rail has its own session, so memory is scoped
          per thread.
        </p>
      </div>
      <ul className="flex flex-col gap-1">
        {suggestions.map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="group w-full text-left rounded-sm border border-line bg-page px-3 py-2 text-[13px] text-ink-2 hover:text-ink hover:border-line-strong flex items-center justify-between transition-colors"
            >
              <span>{s}</span>
              <span className="text-ink-3 opacity-0 group-hover:opacity-100 transition-opacity">
                →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

type ProposedAction = {
  _id: Id<"agent_actions">;
  toolkit: string;
  url: string;
};

function Turn({
  message,
  actions,
  actorSlug,
  isLastAssistant,
  canRegenerate,
  onRegenerate,
  onDismissAction,
}: {
  message: ChatMessage;
  actions: ProposedAction[] | null;
  actorSlug: string | null;
  isLastAssistant: boolean;
  canRegenerate: boolean;
  onRegenerate: () => void;
  onDismissAction: (id: Id<"agent_actions">) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="group flex justify-end">
        <div className="flex flex-col items-end gap-1.5 max-w-[80%]">
          {message.text && (
            <div className="rounded-sm bg-ink text-page px-2.5 py-1.5 text-[13.5px] leading-snug whitespace-pre-wrap relative">
              {message.text}
              <Timestamp
                iso={message.createdAt}
                className="absolute -bottom-4 right-1"
              />
            </div>
          )}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1.5">
              {message.attachments.map((a) => (
                <AttachmentChip key={a.storageId} attachment={a} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="group">
      <ChatMarkdown streaming={message.streaming}>{message.text}</ChatMarkdown>
      <div className="mt-1 flex items-center gap-3 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <Timestamp iso={message.createdAt} />
        {isLastAssistant && !message.streaming && canRegenerate && (
          <button
            onClick={onRegenerate}
            className="text-[11px] text-ink-3 hover:text-ink underline underline-offset-2 decoration-line"
          >
            regenerate
          </button>
        )}
        <CopyButton text={message.text} />
      </div>
      {actions && actions.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {actions.map((a) => (
            <ConnectCta
              key={a._id}
              toolkit={a.toolkit}
              url={a.url}
              actorSlug={actorSlug}
              onDismiss={() => onDismissAction(a._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Timestamp({ iso, className }: { iso: string; className?: string }) {
  const [label, setLabel] = useState(() => relativeTime(iso));
  // Tick once a minute so "just now" → "1m ago" etc. without a hard
  // refresh. Cheap; one interval per visible timestamp is fine for a
  // chat of <100 messages.
  useEffect(() => {
    const id = setInterval(() => setLabel(relativeTime(iso)), 60_000);
    return () => clearInterval(id);
  }, [iso]);
  const absolute = new Date(iso).toLocaleString();
  return (
    <time
      dateTime={iso}
      title={absolute}
      className={`text-[10.5px] text-ink-3 num ${className ?? ""}`}
    >
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

function AttachmentChip({
  attachment,
}: {
  attachment: { storageId: string; name: string; size?: number };
}) {
  const url = useQuery(api.agentMessages.attachmentUrl, {
    storageId: attachment.storageId as Id<"_storage">,
  }) as string | null | undefined;
  return (
    <a
      href={url ?? "#"}
      onClick={(e) => {
        if (!url) e.preventDefault();
      }}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 h-6 px-2 rounded-sm border border-line bg-page text-[11.5px] text-ink hover:bg-surface"
      title={
        attachment.size
          ? `${attachment.name} · ${Math.round(attachment.size / 1024)} KB`
          : attachment.name
      }
    >
      <span className="text-ink-3">📎</span>
      <span className="truncate max-w-[180px]">{attachment.name}</span>
    </a>
  );
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
        } catch {
          /* clipboard denied — silent */
        }
      }}
      className="text-[11px] text-ink-3 hover:text-ink"
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}

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
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      if (!res.redirectUrl) {
        toast.error("Composio returned no URL.");
        return;
      }
      window.location.href = res.redirectUrl;
    } finally {
      setRegenerating(false);
    }
  };

  const dismiss = async () => {
    if (dismissing) return;
    setDismissing(true);
    // Cancel the INITIATED Composio connection alongside marking the
    // agent_action dismissed — otherwise the right rail keeps the
    // toolkit pinned as `pending` until Composio sweeps it. Best-effort:
    // we still call onDismiss() even if the server cancel fails, so the
    // chat CTA reliably disappears.
    if (actorSlug) {
      try {
        await cancelPendingConnections(toolkit, actorSlug);
      } catch {
        /* non-fatal — see comment above */
      }
    }
    onDismiss();
    // Nudge the ConnectionsRail to re-fetch — listConnections lives in
    // its own client-side useEffect that only re-runs on actor change,
    // so without an event the `pending` row sticks around even though
    // Composio just dropped it.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("castle:connections-changed"));
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 text-[12.5px]">
      <div className="inline-flex items-center gap-2 min-w-0 text-ink-3">
        <a
          href={url}
          className="h-7 px-3 rounded-sm bg-ink text-page inline-flex items-center hover:opacity-90"
        >
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

function Thinking({
  tools = [],
  thought = "",
  compact = false,
}: {
  tools?: ToolActivity[];
  thought?: string;
  /** Slim variant rendered alongside assistant text mid-stream. Shows
   *  the same dot loader + elapsed + recent tools but drops the
   *  thought preview (redundant with the streamed text). */
  compact?: boolean;
}) {
  // Tick once a second so the operator can tell the agent is alive
  // through long tool calls (Composio MCP roundtrips, especially the
  // first call against a new connection, can take 5–15s before any
  // text streams). Counter resets via `key=` whenever a new turn
  // starts.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Show the latest 3 tools — older ones collapse silently. Running
  // tools stay until they get a tool_end event.
  const recent = tools.slice(-3);
  const lastThoughtLine = thought
    .trim()
    .split("\n")
    .filter(Boolean)
    .slice(-1)[0];
  const runningToolName = tools.find((t) => t.status === "running")?.name;

  // Compact mode: shown alongside assistant text while it's streaming.
  // A single inline row — dot loader + label + running tool name if
  // any — so the operator can see the agent is actively doing
  // something even when text isn't moving (e.g. mid long tool call).
  if (compact) {
    return (
      <div className="flex items-center gap-2 px-0.5 py-1 text-[11.5px] text-ink-3 num">
        <DotLoader
          frames={THINKING_FRAMES}
          duration={140}
          repeatCount={-1}
          className="gap-px"
          dotClassName="size-[3px] rounded-[1px] bg-ink/15 [&.active]:bg-ink"
        />
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
        <DotLoader
          frames={THINKING_FRAMES}
          duration={140}
          repeatCount={-1}
          className="gap-px"
          dotClassName="size-[3px] rounded-[1px] bg-ink/15 [&.active]:bg-ink"
        />
        <span className="num">
          thinking{elapsed > 0 ? ` · ${elapsed}s` : "…"}
        </span>
      </div>
      {recent.length > 0 && (
        <div className="flex flex-col gap-0.5 pl-4">
          {recent.map((t) => (
            <span key={t.id} className="num text-[11.5px]">
              <span className="text-ink-2">⚡</span>{" "}
              <span className={t.status === "error" ? "text-accent" : ""}>
                {t.name}
              </span>
              {t.status === "running" ? (
                <span className="text-ink-3">…</span>
              ) : t.durationMs ? (
                <span className="text-ink-3">
                  {" "}
                  · {(t.durationMs / 1000).toFixed(1)}s
                </span>
              ) : null}
            </span>
          ))}
        </div>
      )}
      {lastThoughtLine && (
        <div className="pl-4 italic text-ink-3/80 line-clamp-1">
          {lastThoughtLine}
        </div>
      )}
    </div>
  );
}
