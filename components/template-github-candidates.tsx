"use client";

import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { InsertCandidateDialog } from "@/components/dialogs/insert-candidate-dialog";

type Candidate = {
  _id: Id<"template_github_candidates">;
  github_repo: string;
  name: string;
  description?: string;
  discovered_at: string;
};

export function TemplateGithubCandidates() {
  const candidates = useQuery(api.templates.listGithubCandidates, {}) as
    | Candidate[]
    | undefined;
  const dismiss = useMutation(api.templates.dismissGithubCandidate);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Candidate | null>(null);

  const filtered = useMemo(() => {
    if (!candidates) return undefined;
    if (!search.trim()) return candidates;
    const q = search.toLowerCase();
    return candidates.filter(
      (c) =>
        c.github_repo.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q),
    );
  }, [candidates, search]);

  const sync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/templates/sync-github", {
        method: "POST",
      });
      const detail = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        found?: number;
        inserted?: number;
        error?: string;
      };
      if (!res.ok || !detail.ok) {
        toast.error(detail.error ?? `Sync failed: ${res.status}`);
        return;
      }
      toast.success(
        `Found ${detail.found ?? 0} repos, ${detail.inserted ?? 0} new.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const empty = candidates !== undefined && candidates.length === 0;

  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="t-h2 text-ink">
          GitHub candidates
          <span className="t-caption num ml-2">
            {candidates?.length ?? 0}
          </span>
        </h2>
        <button
          onClick={sync}
          disabled={syncing}
          className="text-[11.5px] text-ink-3 hover:text-ink underline underline-offset-2 decoration-line disabled:opacity-50"
        >
          {syncing ? "syncing…" : "sync from GitHub"}
        </button>
      </div>
      {candidates === undefined ? (
        <p className="text-[12px] text-ink-3">Loading…</p>
      ) : empty ? (
        <p className="text-[12px] text-ink-3 leading-snug">
          Nothing pending. Click{" "}
          <span className="text-ink">sync from GitHub</span> to scan the
          42nights org for new repos.
        </p>
      ) : (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidates…"
            className="w-full h-8 rounded-sm border border-line bg-page px-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-ink mb-2"
          />
          <div className="max-h-[360px] overflow-y-auto border border-line rounded-sm">
            <ul className="divide-y divide-line">
              {(filtered ?? []).map((c) => (
                <li key={c._id} className="px-3 py-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-[13px] text-ink">
                      <a
                        href={`https://github.com/${c.github_repo}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline underline-offset-2 decoration-line"
                      >
                        {c.github_repo}
                      </a>
                    </div>
                    {c.description && (
                      <p className="text-[12px] text-ink-3 truncate leading-snug">
                        {c.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelected(c)}
                    className="text-[11px] text-ink-2 hover:text-ink"
                  >
                    insert
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await dismiss({ id: c._id });
                        toast.success("Dismissed.");
                      } catch {
                        toast.error("Failed to dismiss.");
                      }
                    }}
                    className="text-[11px] text-ink-3 hover:text-accent"
                  >
                    dismiss
                  </button>
                </li>
              ))}
              {filtered && filtered.length === 0 && (
                <li className="px-3 py-4 text-[12px] text-ink-3">
                  No matches.
                </li>
              )}
            </ul>
          </div>
        </>
      )}

      {selected && (
        <InsertCandidateDialog
          candidate={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
