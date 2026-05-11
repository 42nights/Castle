"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatDate } from "@/lib/format";

type Kind =
  | "touched"
  | "phase_change"
  | "progress"
  | "reassign"
  | "note"
  | "health"
  | "create"
  | "delete";

const LABEL: Record<Kind, string> = {
  touched: "Touched",
  phase_change: "Phase changed",
  progress: "Progress",
  reassign: "Reassigned",
  note: "Notes saved",
  health: "Health changed",
  create: "Created",
  delete: "Deleted",
};

type Update = {
  _id: string;
  at: string;
  actor_fde_id: string;
  kind: Kind;
  payload_json: string;
};

export function EngagementTimeline({
  engagementSlug,
}: {
  engagementSlug: string;
}) {
  const eng = useQuery(api.engagements.getBySlug, { slug: engagementSlug }) as
    | { _id: string }
    | null
    | undefined;
  const updates = useQuery(
    api.engagements.listUpdatesByEngagement,
    eng ? { engagement_id: eng._id as never } : "skip",
  ) as Update[] | undefined;
  const fdes = useQuery(api.fdes.list) as
    | Array<{ _id: string; name: string }>
    | undefined;

  if (!eng) {
    return (
      <p className="text-ink-3 text-sm">
        Live history available once Convex is provisioned.
      </p>
    );
  }
  if (updates === undefined) {
    return <p className="text-ink-3 text-sm">Loading…</p>;
  }
  if (updates.length === 0) {
    return (
      <p className="text-ink-3 text-sm">
        No activity logged yet. Every state change will land here.
      </p>
    );
  }
  const fdeById = new Map((fdes ?? []).map((f) => [f._id, f]));

  return (
    <ol className="border-t border-line">
      {updates.map((u) => {
        const actor = fdeById.get(u.actor_fde_id);
        let summary = "";
        try {
          const payload = JSON.parse(u.payload_json);
          if (u.kind === "phase_change")
            summary = `${payload.from} → ${payload.to}`;
          else if (u.kind === "progress")
            summary = `${payload.from}% → ${payload.to}%`;
          else if (u.kind === "health")
            summary = `${payload.from} → ${payload.to}`;
          else if (u.kind === "reassign")
            summary = `${payload.fde_ids?.length ?? 0} on team`;
          else if (u.kind === "note")
            summary = `v${payload.version} · ${payload.length}ch`;
          else if (u.kind === "touched" && payload.note) summary = payload.note;
        } catch {
          /* ignore */
        }
        return (
          <li
            key={u._id}
            className="border-b border-line py-3 grid md:grid-cols-[160px_auto_1fr] gap-4 items-center"
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
              {summary || <span className="text-ink-3">—</span>}
              {actor && (
                <span className="ml-2 text-ink-3">
                  · by {actor.name.split(" ")[0]}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
