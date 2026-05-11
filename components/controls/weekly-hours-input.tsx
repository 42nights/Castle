"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";

export function WeeklyHoursInput({
  engagementSlug,
  current,
}: {
  engagementSlug: string;
  current: number;
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
  const [draft, setDraft] = useState(current);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(current), [current]);
  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    if (draft === current) return;
    if (!eng || !actor) {
      toast.error(!actor ? "Pick an actor FDE." : "Engagement missing.");
      setDraft(current);
      return;
    }
    if (draft < 0) {
      toast.error("Hours must be ≥ 0");
      setDraft(current);
      return;
    }
    await run(
      {
        id: eng._id as never,
        patch: { weekly_hours: draft } as never,
        actor_fde_id: actor._id as never,
      },
      { success: `Weekly hours → ${draft}` },
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
        title="Click to adjust weekly committed hours"
      >
        {current}h
      </button>
    );
  }
  return (
    <input
      ref={ref}
      type="number"
      min={0}
      step={1}
      value={draft}
      onChange={(e) => setDraft(Number(e.target.value) || 0)}
      onBlur={commit}
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
