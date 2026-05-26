"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type Conversation = {
  _id: Id<"agent_conversations">;
  title: string;
  hermes_session: string;
  created_at: string;
  updated_at: string;
  visibility?: "personal" | "shared";
  owner_user_id?: string;
};

/**
 * Left rail. Per-actor conversation list with `+ new`, rename (double-
 * click title), and delete (hover ✗). Auto-creates a first conversation
 * when an actor has none.
 *
 * Two sections — Personal (caller-owned) and Shared (visible to all
 * allowlisted operators). The selected conversation id is lifted to the
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
  const personal = useQuery(
    api.agentMessages.listPersonal,
    actorSlug ? {} : "skip",
  ) as Conversation[] | undefined;
  const shared = useQuery(
    api.agentMessages.listShared,
    actorSlug ? {} : "skip",
  ) as Conversation[] | undefined;
  const create = useMutation(api.agentMessages.createConversation);
  const rename = useMutation(api.agentMessages.renameConversation);
  const remove = useMutation(api.agentMessages.deleteConversation);
  const claim = useMutation(api.migrations.claimMyUnownedConversations);

  // Opportunistic migration: claim any legacy unowned conversations
  // whose actor_slug matches the caller's slug. Idempotent — no-op once
  // every row is stamped. Fires once per actor mount; failures are
  // silent (legacy access still works via the actor_slug fallback in
  // conversationAuth.ts).
  useEffect(() => {
    if (!actorSlug) return;
    claim({}).catch(() => {});
  }, [actorSlug, claim]);

  const [renaming, setRenaming] = useState<Id<"agent_conversations"> | null>(
    null,
  );
  const [draftTitle, setDraftTitle] = useState("");

  const allConversations = useMemo(
    () => [...(personal ?? []), ...(shared ?? [])],
    [personal, shared],
  );

  // Auto-select the most recent conversation (or auto-create one). Only
  // auto-creates against the personal list — we never create a shared
  // chat implicitly.
  useEffect(() => {
    if (!actorSlug || personal === undefined || shared === undefined) return;
    if (selectedId && allConversations.some((c) => c._id === selectedId))
      return;
    if (allConversations.length > 0) {
      onSelect(allConversations[0]._id);
      return;
    }
    create({}).then((id) => onSelect(id));
  }, [
    actorSlug,
    personal,
    shared,
    allConversations,
    selectedId,
    onSelect,
    create,
  ]);

  const newChat = async (visibility: "personal" | "shared" = "personal") => {
    if (!actorSlug) {
      toast.error("Pick an actor FDE in the top nav first.");
      return;
    }
    const id = await create({ visibility });
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
    try {
      await remove({ id });
      if (selectedId === id) onSelect(null);
      toast.success("Chat deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    }
  };

  const renderItem = (c: Conversation) => {
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
  };

  const loading = personal === undefined || shared === undefined;

  return (
    <aside className="hidden md:flex shrink-0 w-[220px] border-r border-line flex-col">
      <header className="panel-header">
        <h2 className="t-h2 text-ink">Chats</h2>
        <button
          onClick={() => newChat("personal")}
          className="text-[11px] text-ink-3 hover:text-ink"
          aria-label="New chat"
        >
          + new
        </button>
      </header>

      {!actorSlug ? (
        <p className="px-3 py-3 text-[12px] text-ink-3 leading-snug">
          Sign in to start chatting.
        </p>
      ) : loading ? (
        <p className="px-3 py-3 text-[12px] text-ink-3">Loading…</p>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <Section
            label="Personal"
            count={personal?.length ?? 0}
            onAdd={() => newChat("personal")}
            emptyHint="No personal chats yet."
          >
            {(personal ?? []).map(renderItem)}
          </Section>
          <Section
            label="Shared"
            count={shared?.length ?? 0}
            onAdd={() => newChat("shared")}
            emptyHint="No shared chats yet. Open a personal chat and use 'make shared' to share it with the team."
          >
            {(shared ?? []).map(renderItem)}
          </Section>
        </div>
      )}
    </aside>
  );
}

function Section({
  label,
  count,
  onAdd,
  emptyHint,
  children,
}: {
  label: string;
  count: number;
  onAdd: () => void;
  emptyHint: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-line">
      <div className="flex items-center justify-between px-3 py-1.5 bg-page sticky top-0 z-10">
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-[11px] uppercase tracking-wider text-ink-3 hover:text-ink inline-flex items-center gap-1.5"
        >
          <span className="text-ink-3">{open ? "▾" : "▸"}</span>
          {label}
          <span className="text-ink-3 num">{count}</span>
        </button>
        <button
          onClick={onAdd}
          className="text-[11px] text-ink-3 hover:text-ink"
          aria-label={`New ${label.toLowerCase()} chat`}
        >
          + new
        </button>
      </div>
      {open ? (
        count === 0 ? (
          <p className="px-3 py-3 text-[12px] text-ink-3 leading-snug">
            {emptyHint}
          </p>
        ) : (
          <ul>{children}</ul>
        )
      ) : null}
    </div>
  );
}
