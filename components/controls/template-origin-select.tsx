"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useIsOperator } from "@/lib/role-context";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";

type CustomerRow = { _id: string; slug: string; name: string };

/**
 * Inline origin-customer picker for a template. The page passes the
 * customer slug as `current` (adapter denormalises customer _id → slug);
 * on commit we resolve back to a Convex _id and patch
 * `templates.update.patch.origin_customer_id`.
 */
export function TemplateOriginSelect({
  templateSlug,
  currentCustomerSlug,
  currentName,
}: {
  templateSlug: string;
  currentCustomerSlug: string;
  currentName?: string;
}) {
  const op = useIsOperator();
  const [actorSlug] = useActorSlug();
  const template = useQuery(
    api.templates.getBySlug,
    op ? { slug: templateSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const customers = useQuery(api.customers.list, op ? {} : "skip") as
    | CustomerRow[]
    | undefined;
  const actorFde = useQuery(
    api.fdes.getBySlug,
    op && actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const run = useRunMutation(api.templates.update);
  const [pending, setPending] = useState(false);

  const onChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const nextSlug = e.target.value;
    if (nextSlug === currentCustomerSlug) return;
    const nextCustomer = (customers ?? []).find((c) => c.slug === nextSlug);
    if (!template || !nextCustomer) {
      toast.error("Template or customer not in Convex.");
      e.target.value = currentCustomerSlug;
      return;
    }
    setPending(true);
    await run(
      {
        id: template._id as never,
        patch: { origin_customer_id: nextCustomer._id } as never,
        actor_fde_id: (actorFde?._id ?? null) as never,
      },
      { success: `Origin → ${nextCustomer.name}` },
    );
    setPending(false);
  };

  if (!op) {
    return (
      <span className="h-7 inline-flex items-center rounded-sm text-[12.5px] px-2 text-ink">
        {currentName ?? currentCustomerSlug}
      </span>
    );
  }

  return (
    <select
      value={currentCustomerSlug}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      disabled={pending || !customers}
      className="h-7 rounded-sm border border-line bg-page text-[12.5px] px-2 text-ink hover:border-line-strong focus:outline-none focus:ring-1 focus:ring-ink disabled:opacity-50"
      aria-label="Set template origin customer"
    >
      {(customers ?? []).map((c) => (
        <option key={c.slug} value={c.slug}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
