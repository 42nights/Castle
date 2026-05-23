"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useRunMutation } from "@/lib/use-run-mutation";
import { validatePattern } from "@/lib/auth-allowlist";

type Row = {
  id: string | null;
  pattern: string;
  note: string | null;
  created_at: string;
  created_by_email: string | null;
  kind: "domain" | "email";
  source: "rescue" | "dynamic";
};

type Attempt = {
  id: string;
  email: string;
  attempt_count: number;
  first_attempted_at: string;
  last_attempted_at: string;
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (Number.isNaN(diff) || diff < 0) return iso;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function AllowlistManager() {
  const rows = useQuery(api.emailAllowlist.listWithRescue, {}) as
    | Row[]
    | undefined;
  const add = useRunMutation(api.emailAllowlist.add);
  const remove = useRunMutation(api.emailAllowlist.remove);
  const attempts = useQuery(api.emailAllowlist.listAttempts, {}) as
    | Attempt[]
    | undefined;
  const approveAttempt = useRunMutation(api.emailAllowlist.approveAttempt);
  const dismissAttempt = useRunMutation(api.emailAllowlist.dismissAttempt);

  const [pattern, setPattern] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    let cleaned: string;
    try {
      cleaned = validatePattern(pattern);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid pattern");
      return;
    }
    setPending(true);
    const result = await add(
      { pattern: cleaned, note: note.trim() || undefined },
      { success: `Allowed ${cleaned}` },
    );
    setPending(false);
    if (result) {
      setPattern("");
      setNote("");
    }
  };

  const dynamicCount = (rows ?? []).filter((r) => r.source === "dynamic").length;
  const rescueCount = (rows ?? []).filter((r) => r.source === "rescue").length;

  return (
    <>
      <section className="panel mb-4">
        <header className="panel-header">
          <h2 className="t-h2 text-ink">Add a pattern</h2>
        </header>
        <form onSubmit={onAdd} className="px-3 py-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="t-caption text-ink-3" htmlFor="pattern">
              Pattern
            </label>
            <input
              id="pattern"
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="*@example.com  or  someone@example.com"
              autoComplete="off"
              spellCheck={false}
              className="h-9 rounded-sm border border-line bg-page px-2 num text-[13px] text-ink placeholder:text-ink-3 hover:border-line-strong focus:outline-none focus:ring-1 focus:ring-ink"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="t-caption text-ink-3" htmlFor="note">
              Note <span className="text-ink-3">(optional)</span>
            </label>
            <input
              id="note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why this one's allowed — design partner, contractor, etc."
              className="h-9 rounded-sm border border-line bg-page px-2 text-[13px] text-ink placeholder:text-ink-3 hover:border-line-strong focus:outline-none focus:ring-1 focus:ring-ink"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending || !pattern.trim()}
              className="h-8 px-3 rounded-sm border border-line bg-ink text-page text-[12.5px] hover:bg-ink-2 disabled:opacity-50"
            >
              {pending ? "Adding…" : "Add to allowlist"}
            </button>
            <span className="t-caption text-ink-3">
              Patterns are case-insensitive.
            </span>
          </div>
        </form>
      </section>

      {attempts && attempts.length > 0 && (
        <section className="panel mb-4">
          <header className="panel-header">
            <div className="flex items-baseline gap-2">
              <h2 className="t-h2 text-ink">Recent rejected sign-ins</h2>
              <span className="t-caption">{attempts.length}</span>
            </div>
          </header>
          <div className="panel-body no-pad">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line text-ink-3 uppercase tracking-[0.06em] text-[10px]">
                  <th className="text-left h-8 px-3 font-medium">Email</th>
                  <th className="text-left h-8 px-3 font-medium">Tries</th>
                  <th className="text-left h-8 px-3 font-medium">Last</th>
                  <th className="text-right h-8 px-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-line last:border-b-0"
                  >
                    <td className="px-3 py-2 num text-ink text-[13px]">
                      {a.email}
                    </td>
                    <td className="px-3 py-2 num text-ink-2 text-[12px]">
                      {a.attempt_count}×
                    </td>
                    <td className="px-3 py-2 text-ink-3 text-[12px]">
                      {timeAgo(a.last_attempted_at)}
                    </td>
                    <td className="px-3 py-2 text-right flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          approveAttempt(
                            { id: a.id as never },
                            { success: `Approved ${a.email}` },
                          )
                        }
                        className="text-[12px] text-ink hover:text-accent underline underline-offset-2 decoration-line"
                      >
                        approve
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          dismissAttempt(
                            { id: a.id as never },
                            { success: `Dismissed ${a.email}` },
                          )
                        }
                        className="text-[12px] text-ink-3 hover:text-ink underline underline-offset-2 decoration-line"
                      >
                        dismiss
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel">
        <header className="panel-header">
          <div className="flex items-baseline gap-2">
            <h2 className="t-h2 text-ink">Current allowlist</h2>
            <span className="t-caption">
              {rows === undefined
                ? "loading…"
                : `${dynamicCount} dynamic · ${rescueCount} rescue`}
            </span>
          </div>
        </header>
        <div className="panel-body no-pad">
          {rows === undefined ? (
            <p className="px-3 py-3 text-ink-3 text-[12px]">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-3 py-3 text-ink-3 text-[12px]">
              No patterns yet. Add one above.
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-line text-ink-3 uppercase tracking-[0.06em] text-[10px]">
                  <th className="text-left h-8 px-3 font-medium">Pattern</th>
                  <th className="text-left h-8 px-3 font-medium">Kind</th>
                  <th className="text-left h-8 px-3 font-medium">Note / Added by</th>
                  <th className="text-right h-8 px-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={`${r.source}-${r.id ?? r.pattern}`}
                    className="border-b border-line last:border-b-0"
                  >
                    <td className="px-3 py-2 num text-ink text-[13px]">
                      {r.pattern}
                    </td>
                    <td className="px-3 py-2 text-ink-2 text-[12px]">
                      {r.kind === "domain" ? "domain wildcard" : "email"}
                    </td>
                    <td className="px-3 py-2 text-ink-2 text-[12px]">
                      {r.note ? (
                        <span>{r.note}</span>
                      ) : r.created_by_email ? (
                        <span className="text-ink-3">
                          added by{" "}
                          <span className="num text-ink-2">
                            {r.created_by_email}
                          </span>
                        </span>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.source === "rescue" || !r.id ? (
                        <span className="t-caption text-ink-3">locked</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            remove(
                              { id: r.id as never },
                              { success: `Removed ${r.pattern}` },
                            )
                          }
                          className="text-[12px] text-ink-2 hover:text-[#ff3b47] underline underline-offset-2 decoration-line"
                        >
                          remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
