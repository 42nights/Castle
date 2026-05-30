"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useIsOperator } from "@/lib/role-context";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";

type Tpl = { _id: string; name: string; slug: string; archived_at?: string };

export function TemplateActionsMenu({ slug }: { slug: string }) {
  const op = useIsOperator();
  const tpl = useQuery(api.templates.getBySlug, { slug }) as
    | Tpl
    | null
    | undefined;
  const [actorSlug] = useActorSlug();
  const actor = useQuery(
    api.fdes.getBySlug,
    actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const archive = useRunMutation(api.templates.archive);
  const unarchive = useRunMutation(api.templates.unarchive);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!op || !tpl) return null;

  const isArchived = !!tpl.archived_at;

  const onArchive = async () => {
    if (
      !confirm(
        `Archive template "${tpl.name}"? It'll be hidden from guests but stays here for operators — you can restore it anytime.`,
      )
    )
      return;
    setBusy(true);
    try {
      await archive(
        { id: tpl._id as never, actor_fde_id: (actor?._id ?? null) as never },
        { success: "Template archived" },
      );
      router.push("/templates");
    } catch {
      setBusy(false);
    }
  };

  const onUnarchive = async () => {
    setBusy(true);
    try {
      await unarchive(
        { id: tpl._id as never, actor_fde_id: (actor?._id ?? null) as never },
        { success: "Template restored" },
      );
      setBusy(false);
    } catch {
      setBusy(false);
    }
  };

  return isArchived ? (
    <button
      onClick={onUnarchive}
      disabled={busy}
      className="h-8 px-3 rounded-md border border-line text-[13px] text-ink-2 hover:text-ink hover:border-line-strong disabled:opacity-50"
    >
      {busy ? "Restoring…" : "Unarchive"}
    </button>
  ) : (
    <button
      onClick={onArchive}
      disabled={busy}
      className="h-8 px-3 rounded-md border border-line text-[13px] text-ink-3 hover:text-accent hover:border-accent disabled:opacity-50"
    >
      {busy ? "Archiving…" : "Archive template"}
    </button>
  );
}
