"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { formatDate } from "@/lib/format";

type Note = {
  _id: string;
  body: string;
  actor_fde_id: string;
  base_version: number;
  created_at: string;
};

export function NotesJournal({
  engagementSlug,
}: {
  engagementSlug: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const eng = useQuery(api.engagements.getBySlug, { slug: engagementSlug }) as
    | { _id: string }
    | null
    | undefined;
  const notes = useQuery(
    api.engagements.listNotesByEngagement,
    eng ? { engagement_id: eng._id as never } : "skip",
  ) as Note[] | undefined;
  const fdes = useQuery(api.fdes.list) as
    | Array<{ _id: string; name: string }>
    | undefined;

  if (!eng) {
    return (
      <p className="text-ink-3 text-sm">
        Notes history available once Convex is provisioned.
      </p>
    );
  }
  if (notes === undefined) {
    return <p className="text-ink-3 text-sm">Loading…</p>;
  }
  if (notes.length === 0) {
    return (
      <p className="text-ink-3 text-sm">
        Notes journal is empty. Saves to the editor above land here as
        versioned entries.
      </p>
    );
  }
  const fdeById = new Map((fdes ?? []).map((f) => [f._id, f]));
  const shown = expanded ? notes : notes.slice(0, 3);

  return (
    <ol className="space-y-3">
      {shown.map((n) => {
        const actor = fdeById.get(n.actor_fde_id);
        return (
          <li
            key={n._id}
            className="border border-line rounded-sm p-3 bg-page"
          >
            <div className="flex items-center justify-between t-caption mb-1">
              <span className="num text-ink-3">
                v{n.base_version} ·{" "}
                {formatDate(n.created_at)} ·{" "}
                {new Date(n.created_at).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              {actor && (
                <span className="text-ink-3">by {actor.name.split(" ")[0]}</span>
              )}
            </div>
            <p className="text-[13.5px] leading-relaxed text-ink whitespace-pre-wrap">
              {n.body}
            </p>
          </li>
        );
      })}
      {notes.length > 3 && (
        <li>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="t-caption text-ink-2 hover:text-ink"
          >
            {expanded ? "Show recent only" : `Show all ${notes.length} versions →`}
          </button>
        </li>
      )}
    </ol>
  );
}
