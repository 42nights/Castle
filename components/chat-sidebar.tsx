"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type Conversation = {
  _id: Id<"agent_conversations">;
  title: string;
  hermes_session: string;
  created_at: string;
  updated_at: string;
};

/**
 * Left rail. Per-actor conversation list with `+ new`, rename (double-
 * click title), and delete (hover ✗). Auto-creates a first conversation
 * when an actor has none. The selected conversation id is lifted to the
 * parent so the chat panel and the rail share it.
 */
export function ChatSidebar({
  actorSlug,
  selectedId,
  onSelect,
}: {
  actorSlug: string | null;
  selectedId: Id<"agent_conversations"> | null;
  onSelect: (id: Id<"agent_conversations"> | null) => void;
}) {
  const conversations = useQuery(
    api.agentMessages.listConversations,
    actorSlug ? { actor_slug: actorSlug } : "skip",
  ) as Conversation[] | undefined;
  const create = useMutation(api.agentMessages.createConversation);
  const rename = useMutation(api.agentMessages.renameConversation);
  const remove = useMutation(api.agentMessages.deleteConversation);

  const [renaming, setRenaming] = useState<Id<"agent_conversations"> | null>(
    null,
  );
  const [draftTitle, setDraftTitle] = useState("");

  // Auto-select the most recent conversation (or auto-create one).
  useEffect(() => {
    if (!actorSlug || !conversations) return;
    if (selectedId && conversations.some((c) => c._id === selectedId)) return;
    if (conversations.length > 0) {
      onSelect(conversations[0]._id);
      return;
    }
    // No conversations yet — make one.
    create({ actor_slug: actorSlug }).then((id) => onSelect(id));
  }, [actorSlug, conversations, selectedId, onSelect, create]);

  const newChat = async () => {
    if (!actorSlug) {
      toast.error("Pick an actor FDE in the top nav first.");
      return;
    }
    const id = await create({ actor_slug: actorSlug });
    onSelect(id);
  };

  const commitRename = async (id: Id<"agent_conversations">) => {
    const title = draftTitle.trim();
    setRenaming(null);
    if (!title) return;
    await rename({ id, title });
  };

  const onDelete = async (id: Id<"agent_conversations">, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    await remove({ id });
    if (selectedId === id) onSelect(null);
    toast.success("Chat deleted.");
  };

  return (
    <aside className="hidden md:flex shrink-0 w-[220px] border-r border-line flex-col">
      <header className="panel-header">
        <h2 className="t-h2 text-ink">Chats</h2>
        <button
          onClick={newChat}
          className="text-[11px] text-ink-3 hover:text-ink"
          aria-label="New chat"
        >
          + new
        </button>
      </header>

      {!actorSlug ? (
        <p className="px-3 py-3 text-[12px] text-ink-3 leading-snug">
          Pick an actor in the top nav.
        </p>
      ) : conversations === undefined ? (
        <p className="px-3 py-3 text-[12px] text-ink-3">Loading…</p>
      ) : conversations.length === 0 ? (
        <p className="px-3 py-3 text-[12px] text-ink-3 leading-snug">
          No chats yet. Click <span className="text-ink">+ new</span>.
        </p>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {conversations.map((c) => {
            const active = c._id === selectedId;
            const isRenaming = renaming === c._id;
            return (
              <li
                key={c._id}
                className={`group relative border-b border-line ${
                  active ? "bg-surface" : "hover:bg-surface/60"
                }`}
              >
                {isRenaming ? (
                  <input
                    autoFocus
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onBlur={() => commitRename(c._id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(c._id);
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    className="block w-full bg-page text-ink px-3 py-2 text-[13px] outline-none border border-ink-2"
                  />
                ) : (
                  <button
                    onClick={() => onSelect(c._id)}
                    onDoubleClick={() => {
                      setDraftTitle(c.title);
                      setRenaming(c._id);
                    }}
                    className="block w-full text-left pl-3 pr-12 py-2 text-[13px] truncate text-ink"
                    title="Click to open · Double-click to rename"
                  >
                    {c.title}
                  </button>
                )}
                {!isRenaming && (
                  <div className="absolute right-1 top-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDraftTitle(c.title);
                        setRenaming(c._id);
                      }}
                      className="text-ink-3 hover:text-ink text-[12px] px-1"
                      aria-label="Rename chat"
                      title="Rename"
                    >
                      ✎
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(c._id, c.title);
                      }}
                      className="text-ink-3 hover:text-accent text-[12px] px-1"
                      aria-label="Delete chat"
                      title="Delete"
                    >
                      ✗
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
