"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { initiateConnection } from "@/app/connections/actions";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useActorSlug } from "@/lib/use-actor";
import { useHermesChat, type ChatMessage } from "@/lib/use-hermes-chat";
import { ChatMarkdown } from "@/components/chat-markdown";
import { ChatSidebar } from "@/components/chat-sidebar";
import { ConnectionsRail } from "@/components/connections-rail";

const SUGGESTIONS = [
  "what's red right now?",
  "show me eragon's MRR",
  "list FDEs and their utilization",
  "remember: jerry prefers terse one-line answers",
  "what did i ask you to remember last time?",
];

/**
 * Castle chat landing. Three-column layout:
 *   ChatSidebar (220) · chat (flex) · ConnectionsRail (240)
 *
 * Each conversation in the sidebar has its own Hermes session, so
 * memory is per-thread. Pick an existing chat from the rail or hit
 * `+ new` to start fresh.
 */
export function ChatLanding() {
  const [actorSlug] = useActorSlug();
  const [conversationId, setConversationId] =
    useState<Id<"agent_conversations"> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tailRef = useRef<HTMLDivElement>(null);

  const { messages, status, error, sendMessage, stop } = useHermesChat({
    actorSlug,
    conversationId,
  });
  const clearTranscript = useMutation(api.agentMessages.clear);
  const proposed = useQuery(
    api.agentActions.listOpen,
    actorSlug ? { actor_slug: actorSlug } : "skip",
  ) as
    | Array<{ _id: Id<"agent_actions">; toolkit: string; url: string }>
    | undefined;
  const dismissAction = useMutation(api.agentActions.dismiss);
  const [draft, setDraft] = useState("");

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
              <EmptyState onPick={(s) => setDraft(s)} />
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
                  messages[messages.length - 1]?.text === "" && <Thinking />}
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

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-ink">
          What needs handling?
        </h1>
        <p className="mt-1 text-[12.5px] text-ink-3 leading-snug">
          Powered by Hermes — each chat in the left rail has its own
          session, so memory is scoped per thread.
        </p>
      </div>
      <ul className="flex flex-col gap-1">
        {SUGGESTIONS.map((s) => (
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
      <ChatMarkdown tail={message.streaming ? <StreamingCaret /> : null}>
        {message.text}
      </ChatMarkdown>
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

function StreamingCaret() {
  return (
    <span
      className="inline-block ml-0.5 w-[2px] h-[14px] -mb-[2px] bg-ink animate-pulse"
      aria-hidden
    />
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
          onClick={onDismiss}
          className="text-ink-3 hover:text-ink"
        >
          dismiss
        </button>
      </div>
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex items-center gap-1 px-0.5 py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-ink-2 animate-pulse" />
      <span
        className="w-1.5 h-1.5 rounded-full bg-ink-2 animate-pulse"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full bg-ink-2 animate-pulse"
        style={{ animationDelay: "300ms" }}
      />
    </div>
  );
}
