"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";
import type { EngagementPhase } from "@/lib/types";

const PHASES: EngagementPhase[] = ["discovery", "build", "deployed", "support"];

export function PhaseMenu({
  engagementSlug,
  current,
  className = "",
}: {
  engagementSlug: string;
  current: EngagementPhase;
  className?: string;
}) {
  const [actorSlug] = useActorSlug();
  const eng = useQuery(api.engagements.getBySlug, { slug: engagementSlug }) as
    | { _id: string }
    | null
    | undefined;
  const actorFde = useQuery(
    api.fdes.getBySlug,
    actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const run = useRunMutation(api.engagements.movePhase);
  const [pending, setPending] = useState(false);

  const onChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const next = e.target.value as EngagementPhase;
    if (next === current) return;
    if (!actorFde || !eng) {
      toast.error(
        !actorFde ? "Pick an actor FDE first." : "Engagement not in Convex.",
      );
      e.target.value = current;
      return;
    }
    setPending(true);
    await run(
      { id: eng._id as never, actor_fde_id: actorFde._id as never, phase: next },
      {
        success:
          next === "support"
            ? `Moved to support · progress → 100%`
            : `Moved to ${next}`,
      },
    );
    setPending(false);
  };

  return (
    <select
      value={current}
      onChange={onChange}
      disabled={pending}
      onClick={(e) => e.stopPropagation()}
      className={`h-5 rounded-sm border border-line bg-page text-[10px] uppercase tracking-[0.08em] px-1 text-ink-2 focus:outline-none focus:ring-1 focus:ring-ink disabled:opacity-50 ${className}`}
    >
      {PHASES.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );
}
