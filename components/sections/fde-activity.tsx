"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { formatDate } from "@/lib/format";

type Update = {
  _id: string;
  engagement_id: string;
  at: string;
  kind:
    | "touched"
    | "phase_change"
    | "progress"
    | "reassign"
    | "note"
    | "health"
    | "create"
    | "delete";
  payload_json: string;
};

const LABEL: Record<Update["kind"], string> = {
  touched: "touched",
  phase_change: "moved phase",
  progress: "set progress",
  reassign: "reassigned",
  note: "saved notes",
  health: "set health",
  create: "created",
  delete: "deleted",
};

export function FdeActivity({ fdeSlug }: { fdeSlug: string }) {
  const fde = useQuery(api.fdes.getBySlug, { slug: fdeSlug }) as
    | { _id: string }
    | null
    | undefined;
  const updates = useQuery(
    api.engagements.listUpdatesByActor,
    fde ? { actor_fde_id: fde._id as never, limit: 25 } : "skip",
  ) as Update[] | undefined;
  const engagements = useQuery(api.engagements.list) as
    | Array<{ _id: string; slug: string; customer_id: string }>
    | undefined;
  const customers = useQuery(api.customers.list) as
    | Array<{ _id: string; name: string; slug: string }>
    | undefined;

  if (!fde) {
    return (
      <p className="text-ink-3 text-sm">
        Activity feed available once Convex is provisioned.
      </p>
    );
  }
  if (updates === undefined) return <p className="text-ink-3 text-sm">Loading…</p>;
  if (updates.length === 0)
    return (
      <p className="text-ink-3 text-sm">
        No actions logged yet for this FDE.
      </p>
    );

  const engById = new Map((engagements ?? []).map((e) => [e._id, e]));
  const custById = new Map((customers ?? []).map((c) => [c._id, c]));

  return (
    <ol className="border-t border-line">
      {updates.map((u) => {
        const eng = engById.get(u.engagement_id);
        const customer = eng ? custById.get(eng.customer_id) : null;
        let summary = "";
        try {
          const p = JSON.parse(u.payload_json);
          if (u.kind === "phase_change")
            summary = `${p.from} → ${p.to}`;
          else if (u.kind === "progress")
            summary = `${p.from}% → ${p.to}%`;
          else if (u.kind === "health") summary = `${p.from} → ${p.to}`;
          else if (u.kind === "reassign")
            summary = `${p.fde_ids?.length ?? 0} on team`;
          else if (u.kind === "note") summary = `v${p.version}`;
          else if (u.kind === "touched" && p.note) summary = p.note;
        } catch {
          /* ignore */
        }
        return (
          <li
            key={u._id}
            className="border-b border-line py-3 grid md:grid-cols-[140px_auto_1fr] gap-4 items-center"
          >
            <span className="t-caption num text-ink-3">
              {formatDate(u.at)} ·{" "}
              {new Date(u.at).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            <span className="t-caption inline-flex h-5 items-center rounded-sm border border-line bg-page px-1.5 uppercase tracking-[0.08em] text-ink-2">
              {LABEL[u.kind]}
            </span>
            <span className="text-[13px] text-ink-2">
              {eng && (
                <Link
                  href={`/engagements/${eng.slug}`}
                  className="text-ink hover:underline"
                >
                  {customer?.name ?? eng.slug}
                </Link>
              )}
              {summary && (
                <span className="ml-2 text-ink-3">· {summary}</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
