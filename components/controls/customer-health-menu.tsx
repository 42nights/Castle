"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";
import type { Health } from "@/lib/types";

const HEALTHS: Health[] = ["green", "yellow", "red"];

export function CustomerHealthMenu({
  customerSlug,
  current,
}: {
  customerSlug: string;
  current: Health;
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
  const run = useRunMutation(api.customers.setHealth);
  const [pending, setPending] = useState(false);

  const onChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const next = e.target.value as Health;
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
        health: next,
        actor_fde_id: (actorFde?._id ?? null) as never,
      },
      { success: `Health → ${next}` },
    );
    setPending(false);
  };

  return (
    <select
      value={current}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      disabled={pending}
      className="h-5 rounded-sm border border-line bg-page text-[10px] px-1 text-ink-2 focus:outline-none focus:ring-1 focus:ring-ink disabled:opacity-50"
      aria-label="Set customer health"
    >
      {HEALTHS.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
    </select>
  );
}
