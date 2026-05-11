"use client";

import { useQuery } from "convex/react";
import { useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";

/**
 * Global key bindings while on an engagement detail page.
 *
 *   u    mark touched
 *
 * Skipped when typing into form fields.
 */
export function EngagementKeys({
  engagementSlug,
}: {
  engagementSlug: string;
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
  const run = useRunMutation(api.engagements.markTouched);

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "u") {
        e.preventDefault();
        if (!actor) {
          toast.error("Pick an actor FDE first.");
          return;
        }
        if (!eng) return;
        await run(
          { id: eng._id as never, actor_fde_id: actor._id as never },
          { success: "Marked touched" },
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [eng, actor, run]);

  return null;
}
