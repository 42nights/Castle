"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useIsOperator } from "@/lib/role-context";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";

type FdeRow = { _id: string; slug: string; name: string };

/**
 * Inline author picker for a template. The page passes the FDE slug as
 * `current` (the adapter denormalises FDE _id → slug); on commit we
 * resolve the new slug back to a Convex _id and patch
 * `templates.update.patch.authored_by_fde_id`.
 */
export function TemplateAuthorSelect({
  templateSlug,
  currentFdeSlug,
  currentName,
}: {
  templateSlug: string;
  currentFdeSlug: string;
  currentName?: string;
}) {
  const op = useIsOperator();
  const [actorSlug] = useActorSlug();
  const template = useQuery(
    api.templates.getBySlug,
    op ? { slug: templateSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const fdes = useQuery(api.fdes.list, op ? {} : "skip") as FdeRow[] | undefined;
  const actorFde = useQuery(
    api.fdes.getBySlug,
    op && actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const run = useRunMutation(api.templates.update);
  const [pending, setPending] = useState(false);

  const onChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const nextSlug = e.target.value;
    if (nextSlug === currentFdeSlug) return;
    const nextFde = (fdes ?? []).find((f) => f.slug === nextSlug);
    if (!template || !nextFde) {
      toast.error("Template or FDE not in Convex.");
      e.target.value = currentFdeSlug;
      return;
    }
    setPending(true);
    await run(
      {
        id: template._id as never,
        patch: { authored_by_fde_id: nextFde._id } as never,
        actor_fde_id: (actorFde?._id ?? null) as never,
      },
      { success: `Author → ${nextFde.name}` },
    );
    setPending(false);
  };

  if (!op) {
    return (
      <span className="h-7 inline-flex items-center rounded-sm text-[12.5px] px-2 text-ink">
        {currentName ?? currentFdeSlug}
      </span>
    );
  }

  return (
    <select
      value={currentFdeSlug}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      disabled={pending || !fdes}
      className="h-7 rounded-sm border border-line bg-page text-[12.5px] px-2 text-ink hover:border-line-strong focus:outline-none focus:ring-1 focus:ring-ink disabled:opacity-50"
      aria-label="Set template author"
    >
      {(fdes ?? []).map((f) => (
        <option key={f.slug} value={f.slug}>
          {f.name}
        </option>
      ))}
    </select>
  );
}
