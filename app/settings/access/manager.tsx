"use client";

import { useQuery } from "convex/react";
import { useRef, useState } from "react";
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

type AuditRow = {
  _id: string;
  pattern: string;
  action: "add" | "remove";
  actor_email?: string;
  at: string;
};

type TestEmailResult = {
  matched_pattern: string;
  source: "dynamic" | "rescue";
} | null;

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
  const addBulk = useRunMutation(api.emailAllowlist.addBulk);
  const attempts = useQuery(api.emailAllowlist.listAttempts, {}) as
    | Attempt[]
    | undefined;
  const auditRows = useQuery(api.emailAllowlist.listAudit, {}) as
    | AuditRow[]
    | undefined;
  const approveAttempt = useRunMutation(api.emailAllowlist.approveAttempt);
  const dismissAttempt = useRunMutation(api.emailAllowlist.dismissAttempt);

  const [pattern, setPattern] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  // Test-email state
  const [testEmailInput, setTestEmailInput] = useState("");
  const [testEmailResult, setTestEmailResult] = useState<TestEmailResult | undefined>(
    undefined,
  );
  const [testPending, setTestPending] = useState(false);

  // CSV import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importCsv, setImportCsv] = useState("");
  const [importPreview, setImportPreview] = useState<string[]>([]);
  const [importPending, setImportPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const onTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailInput.trim()) return;
    setTestPending(true);
    setTestEmailResult(undefined);
    try {
      // Use the Convex query directly via fetchQuery pattern via the hook
      // We can't call a query imperatively in Convex React, so we use a workaround:
      // expose testEmail as a callable query via a fetch.
      const url = process.env.NEXT_PUBLIC_CONVEX_URL;
      if (!url) {
        toast.error("NEXT_PUBLIC_CONVEX_URL not set");
        return;
      }
      // Convex HTTP query endpoint
      const res = await fetch(
        `${url.replace(/\/$/, "")}/api/query`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: "emailAllowlist:testEmail",
            args: { email: testEmailInput.trim() },
            format: "json",
          }),
        },
      );
      const data = await res.json();
      setTestEmailResult(data.value as TestEmailResult);
    } catch {
      toast.error("Test failed");
    } finally {
      setTestPending(false);
    }
  };

  const onExportCsv = () => {
    const dynamic = (rows ?? []).filter((r) => r.source === "dynamic");
    const csv = "pattern,note,created_by_email\n" +
      dynamic
        .map(
          (r) =>
            `${JSON.stringify(r.pattern)},${JSON.stringify(r.note ?? "")},${JSON.stringify(r.created_by_email ?? "")}`,
        )
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "email-allowlist.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const parseCsvPatterns = (csv: string): string[] => {
    return csv
      .split(/\r?\n/)
      .map((line) => {
        // Strip quotes and grab first column
        const col = line.split(",")[0]?.replace(/^"|"$/g, "").trim() ?? "";
        return col;
      })
      .filter(
        (p) =>
          p && p.toLowerCase() !== "pattern" && !p.startsWith("#"),
      );
  };

  const onImportCsvChange = (value: string) => {
    setImportCsv(value);
    const parsed = parseCsvPatterns(value);
    setImportPreview(parsed);
  };

  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      onImportCsvChange(text);
    };
    reader.readAsText(file);
  };

  const onImportSubmit = async () => {
    if (importPreview.length === 0) return;
    setImportPending(true);
    const result = await addBulk(
      { patterns: importPreview },
      {
        success: `Imported ${importPreview.length} pattern(s)`,
      },
    );
    setImportPending(false);
    if (result) {
      setImportDialogOpen(false);
      setImportCsv("");
      setImportPreview([]);
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

      {/* Test-email probe */}
      <section className="panel mb-4">
        <header className="panel-header">
          <h2 className="t-h2 text-ink">Test an email</h2>
        </header>
        <form onSubmit={onTestEmail} className="px-3 py-3 flex flex-col gap-3">
          <div className="flex gap-2 items-end">
            <div className="flex flex-col gap-1 flex-1">
              <label className="t-caption text-ink-3" htmlFor="test-email">
                Email address
              </label>
              <input
                id="test-email"
                type="email"
                value={testEmailInput}
                onChange={(e) => setTestEmailInput(e.target.value)}
                placeholder="someone@example.com"
                autoComplete="off"
                spellCheck={false}
                className="h-9 rounded-sm border border-line bg-page px-2 num text-[13px] text-ink placeholder:text-ink-3 hover:border-line-strong focus:outline-none focus:ring-1 focus:ring-ink"
              />
            </div>
            <button
              type="submit"
              disabled={testPending || !testEmailInput.trim()}
              className="h-9 px-3 rounded-sm border border-line bg-page text-ink text-[12.5px] hover:bg-surface-1 disabled:opacity-50 shrink-0"
            >
              {testPending ? "Checking…" : "Check"}
            </button>
          </div>
          {testEmailResult !== undefined && (
            <div className={`px-3 py-2 rounded-sm text-[12px] ${testEmailResult ? "bg-surface-1 text-ink" : "bg-surface-1 text-ink-3"}`}>
              {testEmailResult ? (
                <>
                  <span className="text-ink font-medium">Allowed</span> via{" "}
                  <span className="num text-ink">{testEmailResult.matched_pattern}</span>{" "}
                  <span className="text-ink-3">({testEmailResult.source})</span>
                </>
              ) : (
                "Not covered by any pattern — sign-in would be denied."
              )}
            </div>
          )}
        </form>
      </section>

      {/* CSV export / import */}
      <section className="panel mb-4">
        <header className="panel-header">
          <div className="flex items-center justify-between w-full">
            <h2 className="t-h2 text-ink">CSV export / import</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onExportCsv}
                className="h-7 px-3 rounded-sm border border-line text-[12px] text-ink hover:bg-surface-1"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => setImportDialogOpen(true)}
                className="h-7 px-3 rounded-sm border border-line text-[12px] text-ink hover:bg-surface-1"
              >
                Import CSV
              </button>
            </div>
          </div>
        </header>
        <p className="px-3 py-2 text-ink-3 text-[12px]">
          Export downloads all dynamic patterns. Import skips duplicates (idempotent).
        </p>
      </section>

      {/* CSV import dialog */}
      {importDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-page rounded-sm border border-line w-[500px] max-h-[80vh] overflow-auto">
            <header className="panel-header flex items-center justify-between">
              <h2 className="t-h2 text-ink">Import patterns from CSV</h2>
              <button
                type="button"
                onClick={() => {
                  setImportDialogOpen(false);
                  setImportCsv("");
                  setImportPreview([]);
                }}
                className="text-ink-3 hover:text-ink text-[12px]"
              >
                close
              </button>
            </header>
            <div className="px-3 py-3 flex flex-col gap-3">
              <input
                type="file"
                accept=".csv,text/csv"
                ref={fileInputRef}
                onChange={onImportFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 px-3 rounded-sm border border-line text-[12px] text-ink hover:bg-surface-1 text-left"
              >
                Choose file…
              </button>
              <div className="flex flex-col gap-1">
                <label className="t-caption text-ink-3">
                  Or paste CSV (one pattern per line, first column used):
                </label>
                <textarea
                  value={importCsv}
                  onChange={(e) => onImportCsvChange(e.target.value)}
                  rows={6}
                  spellCheck={false}
                  placeholder={"pattern\n*@example.com\nsomeone@acme.com"}
                  className="rounded-sm border border-line bg-page px-2 py-2 num text-[12px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-ink"
                />
              </div>
              {importPreview.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="t-caption text-ink-3">
                    {importPreview.length} pattern(s) parsed (duplicates will be skipped):
                  </p>
                  <ul className="max-h-40 overflow-auto border border-line rounded-sm divide-y divide-line">
                    {importPreview.map((p, i) => (
                      <li key={i} className="px-2 py-1 num text-[12px] text-ink">
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setImportDialogOpen(false);
                    setImportCsv("");
                    setImportPreview([]);
                  }}
                  className="h-8 px-3 rounded-sm border border-line text-[12px] text-ink-2 hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={importPending || importPreview.length === 0}
                  onClick={onImportSubmit}
                  className="h-8 px-3 rounded-sm border border-line bg-ink text-page text-[12.5px] hover:bg-ink-2 disabled:opacity-50"
                >
                  {importPending ? "Importing…" : `Import ${importPreview.length} pattern(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Recent changes audit panel */}
      {auditRows !== undefined && auditRows.length > 0 && (
        <section className="panel mb-4">
          <header className="panel-header">
            <div className="flex items-baseline gap-2">
              <h2 className="t-h2 text-ink">Recent changes</h2>
              <span className="t-caption">{auditRows.length}</span>
            </div>
          </header>
          <div className="panel-body no-pad">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line text-ink-3 uppercase tracking-[0.06em] text-[10px]">
                  <th className="text-left h-8 px-3 font-medium">Pattern</th>
                  <th className="text-left h-8 px-3 font-medium">Action</th>
                  <th className="text-left h-8 px-3 font-medium">By</th>
                  <th className="text-left h-8 px-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((r) => (
                  <tr
                    key={r._id}
                    className="border-b border-line last:border-b-0"
                  >
                    <td className="px-3 py-2 num text-ink text-[13px]">
                      {r.pattern}
                    </td>
                    <td className="px-3 py-2 text-[12px]">
                      <span
                        className={
                          r.action === "add" ? "text-ink" : "text-ink-3"
                        }
                      >
                        {r.action === "add" ? "added" : "removed"}
                      </span>
                    </td>
                    <td className="px-3 py-2 num text-ink-2 text-[12px]">
                      {r.actor_email ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-ink-3 text-[12px]">
                      {timeAgo(r.at)}
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
