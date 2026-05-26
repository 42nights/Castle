"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { useSyncedDraft } from "@/lib/use-synced-draft";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useIsOperator } from "@/lib/role-context";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";

type Cap = {
  _id: string;
  template_id: string;
  body: string;
  position: number;
};

export function CapabilityEditor({
  templateSlug,
  fallback,
}: {
  templateSlug: string;
  /** Read-only list shown when Convex isn't provisioned. */
  fallback?: string[];
}) {
  const op = useIsOperator();
  const tpl = useQuery(api.templates.getBySlug, { slug: templateSlug }) as
    | { _id: string }
    | null
    | undefined;
  const live = useQuery(
    api.templates.listCapabilities,
    tpl ? { template_id: tpl._id as never } : "skip",
  ) as Cap[] | undefined;
  const [actorSlug] = useActorSlug();
  const actor = useQuery(
    api.fdes.getBySlug,
    actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const add = useRunMutation(api.templates.addCapability);
  const update = useRunMutation(api.templates.updateCapability);
  const swap = useRunMutation(api.templates.swapCapabilityPositions);
  const remove = useRunMutation(api.templates.removeCapability);

  // Fallback path
  if (!tpl) {
    return (
      <ul className="border-t border-line">
        {(fallback ?? []).map((c) => (
          <li
            key={c}
            className="border-b border-line py-3 text-[14.5px] text-ink"
          >
            {c}
          </li>
        ))}
        {(fallback ?? []).length === 0 && (
          <li className="text-ink-3 text-sm py-4">
            No capabilities yet.
          </li>
        )}
      </ul>
    );
  }

  if (!live) {
    return <p className="text-ink-3 text-sm">Loading…</p>;
  }

  const sorted = [...live].sort((a, b) => a.position - b.position);

  if (!op) {
    return (
      <ul className="border-t border-line">
        {sorted.map((cap) => (
          <li
            key={cap._id}
            className="border-b border-line py-3 grid grid-cols-[auto_1fr] items-center gap-3"
          >
            <span className="t-caption num text-ink-3 w-7">
              {cap.position}.
            </span>
            <span className="text-[14.5px] text-ink">{cap.body}</span>
          </li>
        ))}
        {sorted.length === 0 && (
          <li className="text-ink-3 text-sm py-6">No capabilities yet.</li>
        )}
      </ul>
    );
  }

  const onAdd = async () => {
    if (!tpl) return;
    await add(
      {
        template_id: tpl._id as never,
        body: "New capability",
        actor_fde_id: (actor?._id ?? null) as never,
      },
      { success: "Capability added" },
    );
  };

  const move = async (cap: Cap, dir: -1 | 1) => {
    const idx = sorted.findIndex((c) => c._id === cap._id);
    const neighbor = sorted[idx + dir];
    if (!neighbor) return;
    // Atomic swap — single Convex mutation = single transaction. No
    // half-swapped state visible to other clients, no duplicate positions.
    await swap(
      {
        a_id: cap._id as never,
        b_id: neighbor._id as never,
        actor_fde_id: (actor?._id ?? null) as never,
      },
      { success: "Reordered" },
    );
  };

  const editBody = async (cap: Cap, body: string) => {
    if (body === cap.body) return;
    if (!body.trim()) {
      toast.error("Capability cannot be empty");
      return;
    }
    await update(
      {
        capability_id: cap._id as never,
        body: body.trim(),
        actor_fde_id: (actor?._id ?? null) as never,
      },
      { success: "Saved" },
    );
  };

  const del = async (cap: Cap) => {
    await remove(
      { capability_id: cap._id as never },
      { success: "Removed" },
    );
  };

  return (
    <div>
      <ul className="border-t border-line">
        {sorted.map((cap, i) => (
          <CapRow
            key={cap._id}
            cap={cap}
            canUp={i > 0}
            canDown={i < sorted.length - 1}
            onUp={() => move(cap, -1)}
            onDown={() => move(cap, 1)}
            onSave={(body) => editBody(cap, body)}
            onDelete={() => del(cap)}
          />
        ))}
        {sorted.length === 0 && (
          <li className="text-ink-3 text-sm py-6">
            No capabilities yet. Add the first one.
          </li>
        )}
      </ul>
      <button
        onClick={onAdd}
        className="mt-4 h-7 px-3 rounded-sm border border-line bg-page hover:bg-surface text-[12px] text-ink"
      >
        + Capability
      </button>
    </div>
  );
}

function CapRow({
  cap,
  canUp,
  canDown,
  onUp,
  onDown,
  onSave,
  onDelete,
}: {
  cap: Cap;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onSave: (body: string) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft, resetDraft] = useSyncedDraft(cap.body, editing);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    await onSave(draft);
  };

  return (
    <li className="border-b border-line py-3 grid grid-cols-[auto_1fr_auto] items-center gap-3">
      <span className="t-caption num text-ink-3 w-7">
        {cap.position}.
      </span>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "Escape") {
              resetDraft();
              setEditing(false);
            }
          }}
          className="h-7 rounded-sm border border-ink bg-page px-2 text-[14px] text-ink focus:outline-none"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-left text-[14.5px] text-ink hover:bg-surface px-1 rounded-sm"
        >
          {cap.body}
        </button>
      )}
      <span className="inline-flex items-center gap-1">
        <button
          onClick={onUp}
          disabled={!canUp}
          className="h-5 w-5 rounded-sm border border-line bg-page text-ink-2 hover:text-ink disabled:opacity-30 text-[11px]"
          title="Move up"
        >
          ↑
        </button>
        <button
          onClick={onDown}
          disabled={!canDown}
          className="h-5 w-5 rounded-sm border border-line bg-page text-ink-2 hover:text-ink disabled:opacity-30 text-[11px]"
          title="Move down"
        >
          ↓
        </button>
        <button
          onClick={onDelete}
          className="h-5 w-5 rounded-sm border border-line bg-page text-ink-3 hover:text-accent hover:border-accent text-[11px]"
          title="Remove"
        >
          ×
        </button>
      </span>
    </li>
  );
}
