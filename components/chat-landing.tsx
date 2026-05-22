"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  cancelPendingConnections,
  initiateConnection,
} from "@/app/connections/actions";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useChatContext } from "@/lib/chat-context";
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

// Comet across the middle row — quick, light, reads as "outputting".
// Active while assistant text is streaming in.
const STREAMING_FRAMES: number[][] = [
  [21],
  [21, 22],
  [21, 22, 23],
  [22, 23, 24],
  [23, 24, 25],
  [24, 25, 26],
  [25, 26, 27],
  [26, 27],
  [27],
  [],
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
    const id = setInterval(
      () => setB(Math.floor(Date.now() / 60_000)),
      60_000,
    );
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
    thought,
    tools,
  } = useChatContext();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tailRef = useRef<HTMLDivElement>(null);
  const clearTranscript = useMutation(api.agentMessages.clear);
  const proposed = useQuery(
    api.agentActions.listOpen,
    actorSlug ? { actor_slug: actorSlug } : "skip",
  ) as
    | Array<{ _id: Id<"agent_actions">; toolkit: string; url: string }>
    | undefined;
  const dismissAction = useMutation(api.agentActions.dismiss);
  const [draft, setDraft] = useState("");

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
  const suggestions = (dynamicSuggestions ?? []).length > 0
    ? (dynamicSuggestions as Array<{ id: string; prompt: string }>).map((s) => s.prompt)
    : FALLBACK_SUGGESTIONS;

  // Reset draft + focus the input when the user switches conversations.
  useEffect(() => {
    setDraft("");
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
    tailRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, status]);

  const submit = () => {
    const text = draft.trim();
    if (!text || status === "streaming") return;
    sendMessage(text);
    setDraft("");
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
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="mx-auto max-w-[720px] px-6 pt-16 pb-10">
            {empty ? (
              <EmptyState
                suggestions={suggestions}
                onPick={(s) => setDraft(s)}
              />
            ) : (
              <div className="flex flex-col gap-4">
                {(() => {
                  // Render messages. Attach any pending CTAs to the
                  // most recent assistant message — the agent doesn't
                  // always echo the toolkit slug verbatim (e.g. "Connect
                  // button is live in your chat" → no "github" string),
                  // so the old "text must mention the slug" heuristic
                  // hid valid CTAs. CTAs dangle until the user clicks
                  // connect or dismiss.
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
                  return visible.map((m, i) => {
                    const attached =
                      i === lastAssistantIdx && open.length > 0 ? open : [];
                    return (
                      <Turn
                        key={m.id}
                        message={m}
                        actions={attached.length > 0 ? attached : null}
                        actorSlug={actorSlug}
                        onDismissAction={(id) => dismissAction({ id })}
                      />
                    );
                  });
                })()}
                {status === "streaming" &&
                  messages[messages.length - 1]?.text === "" && (
                    <Thinking
                      key={messages.length}
                      tools={tools}
                      thought={thought}
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
              <div className="flex items-center justify-between px-2 pb-2">
                <span className="text-[11px] text-ink-3 inline-flex items-center gap-3">
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
                    disabled={!draft.trim() || !conversationId}
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
          Each chat in the left rail has its own session, so memory is
          scoped per thread.
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
  onDismissAction,
}: {
  message: ChatMessage;
  actions: ProposedAction[] | null;
  actorSlug: string | null;
  onDismissAction: (id: Id<"agent_actions">) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-sm bg-ink text-page px-2.5 py-1.5 text-[13.5px] leading-snug whitespace-pre-wrap">
          {message.text}
        </div>
      </div>
    );
  }
  return (
    <div>
      <ChatMarkdown streaming={message.streaming}>{message.text}</ChatMarkdown>
      {message.streaming && message.text !== "" && (
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-ink-3">
          <DotLoader
            frames={STREAMING_FRAMES}
            duration={80}
            repeatCount={-1}
            className="gap-px"
            dotClassName="size-[3px] rounded-[1px] bg-ink/10 [&.active]:bg-ink/70"
          />
          <span className="num">streaming…</span>
        </div>
      )}
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
}: {
  tools?: ToolActivity[];
  thought?: string;
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
                <span className="text-ink-3"> · {(t.durationMs / 1000).toFixed(1)}s</span>
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
