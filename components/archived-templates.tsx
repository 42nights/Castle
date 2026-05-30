"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";

type ArchivedTpl = {
  _id: string;
  name: string;
  slug: string;
  category: string;
  archived_at?: string;
};

/** Operator-only collapsible list of archived templates with restore.
 *  Rendered on /templates below the grid. Hidden entirely when there's
 *  nothing archived. */
export function ArchivedTemplates() {
  const rows = useQuery(api.templates.listArchived, {}) as
    | ArchivedTpl[]
    | undefined;
  const [actorSlug] = useActorSlug();
  const actor = useQuery(
    api.fdes.getBySlug,
    actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const unarchive = useRunMutation(api.templates.unarchive);
  const [open, setOpen] = useState(false);

  if (!rows || rows.length === 0) return null;

  const restore = async (id: string) => {
    await unarchive(
      { id: id as never, actor_fde_id: (actor?._id ?? null) as never },
      { success: "Template restored" },
    );
  };

  return (
    <section className="mt-8 border-t border-line pt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 t-caption text-ink-3 hover:text-ink"
      >
        <span>{open ? "▾" : "▸"}</span>
        Archived
        <span className="num">{rows.length}</span>
      </button>
      {open && (
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {rows.map((t) => (
            <li
              key={t._id}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <Link
                href={`/templates/${t.slug}`}
                className="min-w-0 flex items-center gap-2 text-[14px] text-ink-2 hover:text-ink"
              >
                <span className="truncate">{t.name}</span>
                <span className="t-caption text-ink-3 shrink-0">
                  {t.category}
                </span>
              </Link>
              <button
                onClick={() => restore(t._id)}
                className="shrink-0 h-7 px-2.5 rounded-sm border border-line bg-page text-[12px] text-ink-2 hover:text-ink hover:border-line-strong"
              >
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
