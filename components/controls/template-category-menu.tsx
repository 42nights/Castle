"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useIsOperator } from "@/lib/role-context";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";
import type { TemplateCategory } from "@/lib/types";

const CATEGORIES: TemplateCategory[] = [
  "GTM",
  "Ops",
  "Content",
  "BD",
  "Research",
];

/**
 * Inline category editor for a template's header. Mirrors the menu
 * pattern in customer-status-menu / customer-health-menu — small
 * select, optimistic toast on commit, blocks until the mutation
 * resolves so a rapid second click doesn't race.
 */
export function TemplateCategoryMenu({
  templateSlug,
  current,
}: {
  templateSlug: string;
  current: TemplateCategory;
}) {
  const op = useIsOperator();
  const [actorSlug] = useActorSlug();
  const template = useQuery(api.templates.getBySlug, {
    slug: templateSlug,
  }) as { _id: string } | null | undefined;
  const actorFde = useQuery(
    api.fdes.getBySlug,
    actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const run = useRunMutation(api.templates.update);
  const [pending, setPending] = useState(false);

  const onChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const next = e.target.value as TemplateCategory;
    if (next === current) return;
    if (!template) {
      toast.error("Template not in Convex.");
      e.target.value = current;
      return;
    }
    setPending(true);
    await run(
      {
        id: template._id as never,
        patch: { category: next } as never,
        actor_fde_id: (actorFde?._id ?? null) as never,
      },
      { success: `Category → ${next}` },
    );
    setPending(false);
  };

  if (!op) {
    return (
      <span className="h-7 inline-flex items-center rounded-sm text-[12.5px] px-2 text-ink">
        {current}
      </span>
    );
  }

  return (
    <select
      value={current}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      disabled={pending}
      className="h-7 rounded-sm border border-line bg-page text-[12.5px] px-2 text-ink hover:border-line-strong focus:outline-none focus:ring-1 focus:ring-ink disabled:opacity-50"
      aria-label="Set template category"
    >
      {CATEGORIES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}
