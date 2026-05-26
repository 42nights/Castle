"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useIsOperator } from "@/lib/role-context";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";

/**
 * Click-to-edit live URL for a template. Stores the canonical URL via
 * `templates.setLiveUrl` which adds `https://` if missing and validates
 * via the URL parser. Mirrors GithubRepoInput's affordances.
 */
export function LiveUrlInput({
  templateSlug,
  current,
}: {
  templateSlug: string;
  current?: string;
}) {
  const op = useIsOperator();
  const tpl = useQuery(api.templates.getBySlug, { slug: templateSlug }) as
    | { _id: string }
    | null
    | undefined;
  const [actorSlug] = useActorSlug();
  const actor = useQuery(
    api.fdes.getBySlug,
    actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const run = useRunMutation(api.templates.setLiveUrl);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current ?? "");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(current ?? ""), [current]);
  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === (current ?? "")) return;
    if (!tpl) {
      toast.error("Template not in Convex.");
      setDraft(current ?? "");
      return;
    }
    await run(
      {
        id: tpl._id as never,
        url: (trimmed || null) as never,
        actor_fde_id: (actor?._id ?? null) as never,
      },
      { success: trimmed ? `Live URL → ${trimmed}` : "Live URL cleared" },
    );
  };

  if (!op) {
    if (!current) {
      return <span className="text-[12px] text-ink-3">—</span>;
    }
    return (
      <a
        href={current}
        target="_blank"
        rel="noreferrer"
        className="num text-[12px] text-ink hover:underline underline-offset-2 decoration-line max-w-[260px] truncate"
      >
        {current.replace(/^https?:\/\//, "")}
      </a>
    );
  }

  if (!editing) {
    if (!current) {
      return (
        <button
          onClick={() => setEditing(true)}
          className="text-[12px] text-ink-3 hover:text-ink underline underline-offset-2 decoration-line"
        >
          + add live URL
        </button>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px]">
        <a
          href={current}
          target="_blank"
          rel="noreferrer"
          className="num text-ink hover:underline underline-offset-2 decoration-line max-w-[260px] truncate"
        >
          {current.replace(/^https?:\/\//, "")}
        </a>
        <button
          onClick={() => setEditing(true)}
          className="text-ink-3 hover:text-ink"
          title="Edit URL"
          aria-label="Edit URL"
        >
          ✎
        </button>
      </span>
    );
  }

  return (
    <input
      ref={ref}
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(current ?? "");
          setEditing(false);
        }
      }}
      placeholder="https://example.com"
      className="num h-6 w-72 rounded-sm border border-ink bg-page px-1.5 text-ink text-[12px] focus:outline-none"
    />
  );
}
