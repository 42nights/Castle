"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";
import { useSyncedDraft } from "@/lib/use-synced-draft";
import { formatUsd } from "@/lib/format";

export function MrrInput({
  customerSlug,
  current,
}: {
  customerSlug: string;
  current: number;
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
  const run = useRunMutation(api.customers.setMrr);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft, resetDraft] = useSyncedDraft(current, editing);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    if (draft === current) return;
    if (!customer) {
      toast.error("Customer not in Convex.");
      resetDraft();
      return;
    }
    if (draft < 0) {
      toast.error("MRR must be ≥ 0");
      resetDraft();
      return;
    }
    await run(
      {
        id: customer._id as never,
        current_mrr: draft,
        actor_fde_id: (actorFde?._id ?? null) as never,
      },
      { success: `MRR → ${formatUsd(draft)}` },
    );
  };

  if (!editing) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        className="num text-ink text-right hover:bg-surface rounded-sm px-1"
        title="Click to edit MRR"
      >
        {formatUsd(current)}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      type="number"
      inputMode="numeric"
      step={50}
      min={0}
      value={draft}
      onChange={(e) => setDraft(Number(e.target.value) || 0)}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === "Escape") {
          resetDraft();
          setEditing(false);
        }
      }}
      className="num h-6 w-24 rounded-sm border border-ink bg-page px-1.5 text-right text-ink text-[12.5px] focus:outline-none"
    />
  );
}
