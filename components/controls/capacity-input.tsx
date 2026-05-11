"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";

export function CapacityInput({
  fdeSlug,
  current,
}: {
  fdeSlug: string;
  current: number;
}) {
  const [actorSlug] = useActorSlug();
  const fde = useQuery(api.fdes.getBySlug, { slug: fdeSlug }) as
    | { _id: string }
    | null
    | undefined;
  const actorFde = useQuery(
    api.fdes.getBySlug,
    actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const run = useRunMutation(api.fdes.setCapacity);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(current), [current]);
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    if (draft === current) return;
    if (!fde) {
      toast.error("FDE not in Convex.");
      setDraft(current);
      return;
    }
    if (draft < 0) {
      toast.error("Capacity must be ≥ 0");
      setDraft(current);
      return;
    }
    await run(
      {
        id: fde._id as never,
        capacity_hours_per_week: draft,
        actor_fde_id: (actorFde?._id ?? null) as never,
      },
      { success: `Capacity → ${draft}h/wk` },
    );
  };

  if (!editing) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        className="num text-ink hover:bg-surface rounded-sm px-1"
        title="Click to adjust weekly capacity"
      >
        {current}h
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      type="number"
      inputMode="numeric"
      step={1}
      min={0}
      value={draft}
      onChange={(e) => setDraft(Number(e.target.value) || 0)}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === "Escape") {
          setDraft(current);
          setEditing(false);
        }
      }}
      className="num h-6 w-14 rounded-sm border border-ink bg-page px-1.5 text-ink text-[12.5px] focus:outline-none"
    />
  );
}
