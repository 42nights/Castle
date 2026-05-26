"use client";

import { useMutation, useQuery } from "convex/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useActorSlug } from "@/lib/use-actor";
import { useHermesChat, type ChatMessage } from "@/lib/use-hermes-chat";
import { ChatMarkdown } from "@/components/chat-markdown";

/**
 * Slide-out chat panel. ⌘J to open/close. Reuses the most-recent
 * conversation for the actor (so messages land in the same thread the
 * landing-page chat is showing).
 */
export function AgentPanel() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [actorSlug] = useActorSlug();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const onChatLanding = pathname === "/";

  const conversations = useQuery(
    api.agentMessages.listPersonal,
    actorSlug ? {} : "skip",
  ) as { _id: Id<"agent_conversations"> }[] | undefined;
  const create = useMutation(api.agentMessages.createConversation);
  const proposed = useQuery(
    api.agentActions.listOpen,
    actorSlug ? { actor_slug: actorSlug } : "skip",
  ) as
    | Array<{ _id: Id<"agent_actions">; toolkit: string; url: string }>
    | undefined;
  const dismissAction = useMutation(api.agentActions.dismiss);
  const [conversationId, setConversationId] =
    useState<Id<"agent_conversations"> | null>(null);

  // Latch onto the most-recent existing personal conversation, or
  // create one lazily the first time the panel is opened. The slide-
  // out panel always uses a personal thread — shared chats live only
  // on the landing page.
  useEffect(() => {
    if (!actorSlug || !conversations) return;
    if (conversationId) return;
    if (conversations.length > 0) {
      setConversationId(conversations[0]._id);
    } else if (open) {
      create({ visibility: "personal" }).then(setConversationId);
    }
  }, [actorSlug, conversations, conversationId, open, create]);

  const { messages, status, error, sendMessage, stop } = useHermesChat({
    actorSlug,
    conversationId,
  });
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const submit = () => {
    const text = draft.trim();
    if (!text || status === "streaming") return;
    sendMessage(text);
    setDraft("");
  };

  if (onChatLanding) return null;

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-30 h-9 px-3 rounded-md border border-line bg-page text-[12px] text-ink hover:bg-surface flex items-center gap-2"
        aria-label="Toggle Castle agent"
      >
        <span className="hp" data-health="red" /> ask Castle
        <kbd className="num text-[10px] text-ink-2">⌘J</kbd>
      </button>

      {open && (
        <aside className="fixed right-0 top-0 z-40 h-full w-full md:w-[440px] border-l border-line bg-page flex flex-col">
          <header className="panel-header shrink-0">
            <div className="flex items-baseline gap-2">
              <h2 className="t-h2 text-ink">Castle agent</h2>
              <span className="t-caption">
                castle · {actorSlug ?? "no actor"}
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-ink-3 hover:text-ink text-[14px]"
              aria-label="Close"
            >
              ✕
            </button>
          </header>

          <div className="flex-1 overflow-auto px-3 py-3 flex flex-col gap-3 text-[13.5px]">
            {messages.length === 0 && (
              <div className="text-ink-3 text-[12.5px] leading-snug">
                This continues your most recent chat. Switch threads from the
                sidebar on the landing page.
              </div>
            )}
            {messages.map((m) => {
              if (m.streaming && m.text === "") return null;
              return <Bubble key={m.id} message={m} />;
            })}
            {status === "streaming" &&
              messages[messages.length - 1]?.text === "" && (
                <div className="text-ink-3 text-[11.5px]">…</div>
              )}
            {error && <div className="text-accent text-[12px]">{error}</div>}
            {proposed && proposed.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {proposed.map((a) => (
                  <div
                    key={a._id}
                    className="rounded-sm border border-line bg-surface px-2.5 py-1.5 flex items-center justify-between gap-2"
                  >
                    <span className="text-[12.5px] text-ink">
                      Connect <span className="num">{a.toolkit}</span>
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => dismissAction({ id: a._id })}
                        className="text-[10.5px] text-ink-3 hover:text-ink"
                      >
                        ✕
                      </button>
                      <a
                        href={a.url}
                        className="h-6 px-2 rounded-sm bg-ink text-page text-[11px] inline-flex items-center"
                      >
                        connect →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-line p-2 flex items-end gap-2">
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
              placeholder="What do you want done? ⏎ to send, ⇧⏎ for newline"
              rows={2}
              disabled={!conversationId}
              className="flex-1 resize-none rounded-sm border border-line bg-page px-2 py-1.5 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-ink-2 disabled:opacity-50"
            />
            {status === "streaming" ? (
              <button
                onClick={stop}
                className="h-9 px-3 rounded-sm border border-line text-[12px] text-ink-2 hover:text-ink"
              >
                stop
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!draft.trim() || !conversationId}
                className="h-9 px-3 rounded-sm bg-ink text-page text-[12px] disabled:opacity-40"
              >
                send
              </button>
            )}
          </div>
        </aside>
      )}
    </>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-sm bg-ink text-page px-2.5 py-1.5 text-[13px] leading-snug whitespace-pre-wrap">
          {message.text}
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-full">
      <ChatMarkdown streaming={message.streaming}>{message.text}</ChatMarkdown>
    </div>
  );
}
