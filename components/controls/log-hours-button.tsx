"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";

export function LogHoursButton({ fdeSlug }: { fdeSlug: string }) {
  const [actorSlug] = useActorSlug();
  const fde = useQuery(api.fdes.getBySlug, { slug: fdeSlug }) as
    | { _id: string; hours_this_week: number }
    | null
    | undefined;
  const actorFde = useQuery(
    api.fdes.getBySlug,
    actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const run = useRunMutation(api.fdes.logHours);
  const [pending, setPending] = useState(false);

  const adjust = async (delta: number) => {
    if (!fde) {
      toast.error("FDE not in Convex.");
      return;
    }
    setPending(true);
    await run(
      {
        id: fde._id as never,
        delta,
        actor_fde_id: (actorFde?._id ?? null) as never,
      },
      { success: `${delta > 0 ? "+" : ""}${delta}h logged` },
    );
    setPending(false);
  };

  return (
    <span className="inline-flex items-center gap-1">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void adjust(-1);
        }}
        disabled={pending}
        className="h-5 w-5 rounded-sm border border-line bg-page text-ink-2 hover:text-ink hover:bg-surface text-[11px] flex items-center justify-center disabled:opacity-40"
        title="Log -1h this week"
      >
        −
      </button>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void adjust(1);
        }}
        disabled={pending}
        className="h-5 w-5 rounded-sm border border-line bg-page text-ink-2 hover:text-ink hover:bg-surface text-[11px] flex items-center justify-center disabled:opacity-40"
        title="Log +1h this week"
      >
        +
      </button>
    </span>
  );
}
