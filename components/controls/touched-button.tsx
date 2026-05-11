"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";

type Variant = "pill" | "icon" | "ghost";

export function TouchedButton({
  engagementSlug,
  variant = "pill",
  className = "",
}: {
  engagementSlug: string;
  variant?: Variant;
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
  const run = useRunMutation(api.engagements.markTouched);
  const [pending, setPending] = useState(false);

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!actorFde) {
      toast.error("Pick an actor FDE in the top-right first.");
      return;
    }
    if (!eng) {
      toast.error("Engagement not found in Convex — has the seed run?");
      return;
    }
    setPending(true);
    await run(
      { id: eng._id as never, actor_fde_id: actorFde._id as never },
      { success: "Marked updated" },
    );
    setPending(false);
  };

  const styles =
    variant === "pill"
      ? "h-6 px-2 rounded-sm border border-line bg-page hover:bg-surface text-[11px] text-ink-2 hover:text-ink"
      : variant === "icon"
        ? "h-6 w-6 rounded-sm border border-line bg-page hover:bg-surface text-ink-2 hover:text-ink flex items-center justify-center"
        : "text-ink-2 hover:text-ink text-[11px]";

  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={`${styles} ${className} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
      title="Mark engagement updated today"
    >
      {variant === "icon" ? "✓" : pending ? "saving…" : "touched today"}
    </button>
  );
}
