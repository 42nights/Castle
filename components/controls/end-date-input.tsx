"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";
import { useSyncedDraft } from "@/lib/use-synced-draft";

export function EndDateInput({
  engagementSlug,
  current,
}: {
  engagementSlug: string;
  current: string;
}) {
  const eng = useQuery(api.engagements.getBySlug, { slug: engagementSlug }) as
    | { _id: string }
    | null
    | undefined;
  const [actorSlug] = useActorSlug();
  const actor = useQuery(
    api.fdes.getBySlug,
    actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const run = useRunMutation(api.engagements.update);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft, resetDraft] = useSyncedDraft(current, editing);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    if (draft === current) return;
    if (!eng || !actor) {
      toast.error(!actor ? "Pick an actor FDE." : "Engagement missing.");
      resetDraft();
      return;
    }
    await run(
      {
        id: eng._id as never,
        patch: { expected_end_date: draft } as never,
        actor_fde_id: actor._id as never,
      },
      { success: `End date → ${draft}` },
    );
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="num text-ink hover:bg-surface rounded-sm px-1"
        title="Click to adjust expected end date"
      >
        {current}
      </button>
    );
  }
  return (
    <input
      ref={ref}
      type="date"
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
      className="num h-7 rounded-sm border border-ink bg-page px-1.5 text-ink text-[12.5px] focus:outline-none"
    />
  );
}
