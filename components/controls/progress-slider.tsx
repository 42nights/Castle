"use client";

import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";

export function ProgressSlider({
  engagementSlug,
  current,
}: {
  engagementSlug: string;
  current: number;
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
  const run = useRunMutation(api.engagements.setProgress);

  const [draft, setDraft] = useState(current);
  useEffect(() => setDraft(current), [current]);

  const commit = async () => {
    if (draft === current) return;
    if (!actorFde || !eng) {
      toast.error(
        !actorFde ? "Pick an actor FDE first." : "Engagement not in Convex.",
      );
      setDraft(current);
      return;
    }
    await run(
      { id: eng._id as never, actor_fde_id: actorFde._id as never, pct: draft },
      { success: `Progress → ${draft}%` },
    );
  };

  return (
    <div className="flex items-center gap-2 w-full">
      <input
        type="range"
        min={0}
        max={100}
        value={draft}
        onChange={(e) => setDraft(Number(e.target.value))}
        onMouseUp={commit}
        onTouchEnd={commit}
        onKeyUp={(e) => {
          if (e.key === "Enter" || e.key === "ArrowLeft" || e.key === "ArrowRight")
            commit();
        }}
        onClick={(e) => e.stopPropagation()}
        className="flex-1 accent-ink h-1"
      />
      <span className="num text-ink text-[11px] w-9 text-right">{draft}%</span>
    </div>
  );
}
