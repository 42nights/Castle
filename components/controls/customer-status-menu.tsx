"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";
import type { CustomerStatus } from "@/lib/types";

const STATUSES: CustomerStatus[] = ["active", "paused", "churned"];

export function CustomerStatusMenu({
  customerSlug,
  current,
}: {
  customerSlug: string;
  current: CustomerStatus;
}) {
  const [actorSlug] = useActorSlug();
  const customer = useQuery(api.customers.getBySlug, { slug: customerSlug }) as
    | { _id: string }
    | null
    | undefined;
  const actorFde = useQuery(
    api.fdes.getBySlug,
    actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const run = useRunMutation(api.customers.setStatus);
  const [pending, setPending] = useState(false);

  const onChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const next = e.target.value as CustomerStatus;
    if (next === current) return;
    if (!customer) {
      toast.error("Customer not in Convex.");
      e.target.value = current;
      return;
    }
    setPending(true);
    await run(
      {
        id: customer._id as never,
        status: next,
        actor_fde_id: (actorFde?._id ?? null) as never,
      },
      { success: `Status → ${next}` },
    );
    setPending(false);
  };

  return (
    <select
      value={current}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      disabled={pending}
      className="h-7 rounded-sm border border-line bg-page text-[12.5px] px-2 text-ink hover:border-line-strong focus:outline-none focus:ring-1 focus:ring-ink disabled:opacity-50"
      aria-label="Set customer status"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
