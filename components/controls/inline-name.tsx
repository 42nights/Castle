"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useIsOperator } from "@/lib/role-context";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";
import { useSyncedDraft } from "@/lib/use-synced-draft";

type Kind = "customer" | "fde" | "template";

const API = {
  customer: { get: api.customers.getBySlug, update: api.customers.update },
  fde: { get: api.fdes.getBySlug, update: api.fdes.update },
  template: { get: api.templates.getBySlug, update: api.templates.update },
} as const;

export function InlineName({
  kind,
  slug,
  current,
  className = "",
}: {
  kind: Kind;
  slug: string;
  current: string;
  className?: string;
}) {
  const op = useIsOperator();
  const entity = useQuery(API[kind].get, { slug }) as
    | { _id: string }
    | null
    | undefined;
  const [actorSlug] = useActorSlug();
  const actor = useQuery(
    api.fdes.getBySlug,
    actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const run = useRunMutation(API[kind].update);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft, resetDraft] = useSyncedDraft(current, editing);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    if (draft.trim() === current.trim()) return;
    if (!draft.trim()) {
      toast.error("Name cannot be empty");
      resetDraft();
      return;
    }
    if (!entity) {
      toast.error("Entity not in Convex.");
      resetDraft();
      return;
    }
    await run(
      {
        id: entity._id as never,
        patch: { name: draft.trim() } as never,
        actor_fde_id: (actor?._id ?? null) as never,
      },
      { success: "Renamed" },
    );
  };

  if (!op) {
    return <span className={className}>{current}</span>;
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className={`${className} hover:bg-surface rounded-sm px-1 -mx-1`}
        title="Click to rename"
      >
        {current}
      </button>
    );
  }

  return (
    <input
      ref={ref}
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
      className={`${className} h-12 px-1 rounded-sm border border-ink bg-page focus:outline-none`}
    />
  );
}
