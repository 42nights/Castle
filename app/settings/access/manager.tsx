"use client";

import { useQuery } from "convex/react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, Lock, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useRunMutation } from "@/lib/use-run-mutation";
import { validatePattern } from "@/lib/auth-allowlist";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

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

type TestEmailResult = {
  matched_pattern: string;
  source: "dynamic" | "rescue";
} | null;

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toISOString().replace("T", " ").slice(0, 16);
  } catch {
    return iso;
  }
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
  const approveAttempt = useRunMutation(api.emailAllowlist.approveAttempt);
  const dismissAttempt = useRunMutation(api.emailAllowlist.dismissAttempt);

  const [pattern, setPattern] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  // Test-email state
  const [testEmailInput, setTestEmailInput] = useState("");
  const [testEmailResult, setTestEmailResult] = useState<
    TestEmailResult | undefined
  >(undefined);
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
      const url = process.env.NEXT_PUBLIC_CONVEX_URL;
      if (!url) {
        toast.error("NEXT_PUBLIC_CONVEX_URL not set");
        return;
      }
      const res = await fetch(`${url.replace(/\/$/, "")}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "emailAllowlist:testEmail",
          args: { email: testEmailInput.trim() },
          format: "json",
        }),
      });
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
    const csv =
      "pattern,note,created_by_email\n" +
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
        const col = line.split(",")[0]?.replace(/^"|"$/g, "").trim() ?? "";
        return col;
      })
      .filter((p) => p && p.toLowerCase() !== "pattern" && !p.startsWith("#"));
  };

  const onImportCsvChange = (value: string) => {
    setImportCsv(value);
    setImportPreview(parseCsvPatterns(value));
  };

  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onImportCsvChange(ev.target?.result as string);
    };
    reader.readAsText(file);
  };

  const onImportSubmit = async () => {
    if (importPreview.length === 0) return;
    setImportPending(true);
    const result = await addBulk(
      { patterns: importPreview },
      { success: `Imported ${importPreview.length} pattern(s)` },
    );
    setImportPending(false);
    if (result) {
      setImportDialogOpen(false);
      setImportCsv("");
      setImportPreview([]);
    }
  };

  const copyPattern = (p: string) => {
    navigator.clipboard.writeText(p).then(() => toast.success("Copied"));
  };

  const dynamicCount = (rows ?? []).filter((r) => r.source === "dynamic").length;
  const rescueCount = (rows ?? []).filter((r) => r.source === "rescue").length;

  return (
    <div className="space-y-6">
      {/* Add pattern form */}
      <section className="panel">
        <header className="panel-header">
          <h2 className="t-h2 text-ink">Add a pattern</h2>
        </header>
        <form onSubmit={onAdd} className="panel-body flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="t-caption" htmlFor="pattern">
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
              className="h-9 rounded-sm border border-line bg-canvas px-2.5 font-mono text-[13px] text-ink placeholder:text-ink-3 hover:border-line-strong focus:outline-none focus:border-line-strong focus:shadow-[var(--shadow-focus)] transition-[border-color,box-shadow]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="t-caption" htmlFor="note">
              Note{" "}
              <span className="text-ink-4">(optional)</span>
            </label>
            <input
              id="note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why this one's allowed — design partner, contractor, etc."
              className="h-9 rounded-sm border border-line bg-canvas px-2.5 text-[13px] text-ink placeholder:text-ink-3 hover:border-line-strong focus:outline-none focus:border-line-strong focus:shadow-[var(--shadow-focus)] transition-[border-color,box-shadow]"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={pending || !pattern.trim()}
              loading={pending}
            >
              Add to allowlist
            </Button>
            <span className="t-caption text-ink-3">
              Patterns are case-insensitive.
            </span>
          </div>
        </form>
      </section>

      {/* 2-column body: rules left, denied attempts right */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* Left: rules list */}
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
            <div className="flex gap-2">
              <Button variant="outline" size="xs" onClick={onExportCsv}>
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => setImportDialogOpen(true)}
              >
                Import CSV
              </Button>
            </div>
          </header>
          <div className="panel-body no-pad">
            {rows === undefined ? (
              <p className="px-4 py-4 text-ink-3 text-[13px]">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="px-4 py-4 text-ink-3 text-[13px]">
                No patterns yet. Add one above.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {rows.map((r) => (
                  <li
                    key={`${r.source}-${r.id ?? r.pattern}`}
                    className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-surface-1 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {r.source === "rescue" && (
                          <Tooltip
                            content="Can't be deleted — hard-coded for recovery"
                            side="right"
                          >
                            <span
                              className="text-ink-3 shrink-0"
                              aria-label="rescue entry, cannot be deleted"
                            >
                              <Lock size={12} aria-hidden="true" />
                            </span>
                          </Tooltip>
                        )}
                        <span className="font-mono text-[13px] text-ink truncate">
                          {r.pattern}
                        </span>
                        <span className="text-[11px] text-ink-3 shrink-0">
                          {r.kind === "domain" ? "domain" : "email"}
                        </span>
                      </div>
                      {(r.note ?? r.created_by_email) && (
                        <p className="text-[11px] text-ink-3 mt-0.5">
                          {r.note ??
                            (r.created_by_email
                              ? `Added by ${r.created_by_email}`
                              : "")}
                        </p>
                      )}
                    </div>

                    {/* Row actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Tooltip content="Copy pattern">
                        <button
                          type="button"
                          onClick={() => copyPattern(r.pattern)}
                          className="p-1 rounded-sm text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors focus-visible:shadow-[var(--shadow-focus)] outline-none"
                          aria-label={`Copy ${r.pattern}`}
                        >
                          <Copy size={13} aria-hidden="true" />
                        </button>
                      </Tooltip>

                      {r.source !== "rescue" && r.id ? (
                        <Tooltip content="Remove rule">
                          <button
                            type="button"
                            onClick={() =>
                              remove(
                                { id: r.id as never },
                                { success: `Removed ${r.pattern}` },
                              )
                            }
                            className="p-1 rounded-sm text-ink-3 hover:text-health-bad hover:bg-health-soft-bad transition-colors focus-visible:shadow-[var(--shadow-focus)] outline-none"
                            aria-label={`Remove ${r.pattern}`}
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        </Tooltip>
                      ) : (
                        <span className="size-[29px]" aria-hidden="true" />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Right: denied attempts ledger */}
        <div className="space-y-4">
          {/* Denied attempts */}
          <section className="panel">
            <header className="panel-header">
              <div className="flex items-baseline gap-2">
                <h2 className="t-h2 text-ink">Recent denied sign-ins</h2>
                {attempts !== undefined && (
                  <span className="t-caption">{attempts.length}</span>
                )}
              </div>
            </header>
            <div className="panel-body no-pad">
              {attempts === undefined ? (
                <p className="px-4 py-4 text-ink-3 text-[13px]">Loading…</p>
              ) : attempts.length === 0 ? (
                <p className="px-4 py-4 text-ink-3 text-[13px]">
                  No denied attempts.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {attempts.map((a) => (
                    <li
                      key={a.id}
                      className="px-4 py-3 flex flex-col gap-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-[13px] text-ink break-all min-w-0">
                          {a.email}
                        </span>
                        <span className="font-mono text-[11px] text-ink-3 shrink-0">
                          {a.attempt_count}×
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-ink-3">
                          {formatTimestamp(a.last_attempted_at)}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              approveAttempt(
                                { id: a.id as never },
                                { success: `Approved ${a.email}` },
                              )
                            }
                            className="text-[12px] text-accent hover:text-accent-ink underline underline-offset-2 decoration-accent/40 focus-visible:shadow-[var(--shadow-focus)] outline-none rounded-sm"
                          >
                            Add as allow
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              dismissAttempt(
                                { id: a.id as never },
                                { success: `Dismissed ${a.email}` },
                              )
                            }
                            className="text-[12px] text-ink-3 hover:text-ink underline underline-offset-2 decoration-line focus-visible:shadow-[var(--shadow-focus)] outline-none rounded-sm"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Test email probe */}
          <section className="panel">
            <header className="panel-header">
              <h2 className="t-h2 text-ink">Test an email</h2>
            </header>
            <form onSubmit={onTestEmail} className="panel-body flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  id="test-email"
                  type="email"
                  value={testEmailInput}
                  onChange={(e) => setTestEmailInput(e.target.value)}
                  placeholder="someone@example.com"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Email to test against allowlist"
                  className="flex-1 h-9 rounded-sm border border-line bg-canvas px-2.5 font-mono text-[13px] text-ink placeholder:text-ink-3 hover:border-line-strong focus:outline-none focus:border-line-strong focus:shadow-[var(--shadow-focus)] transition-[border-color,box-shadow]"
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={testPending || !testEmailInput.trim()}
                  loading={testPending}
                >
                  Check
                </Button>
              </div>
              {testEmailResult !== undefined && (
                <div
                  role="status"
                  className={`px-3 py-2 rounded-sm text-[12px] ${
                    testEmailResult
                      ? "bg-health-soft-good text-health-good"
                      : "bg-health-soft-bad text-health-bad"
                  }`}
                >
                  {testEmailResult ? (
                    <>
                      <span className="font-medium">Allowed</span> via{" "}
                      <span className="font-mono">
                        {testEmailResult.matched_pattern}
                      </span>{" "}
                      <span className="opacity-70">
                        ({testEmailResult.source})
                      </span>
                    </>
                  ) : (
                    "Not covered — sign-in would be denied."
                  )}
                </div>
              )}
            </form>
          </section>
        </div>
      </div>

      {/* CSV import dialog */}
      {importDialogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-dialog-title"
          className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setImportDialogOpen(false);
              setImportCsv("");
              setImportPreview([]);
            }
          }}
        >
          <div className="bg-canvas rounded-lg shadow-[var(--shadow-xl)] w-[500px] max-h-[80vh] overflow-auto">
            <header className="panel-header">
              <h2
                id="import-dialog-title"
                className="t-h2 text-ink"
              >
                Import patterns from CSV
              </h2>
              <button
                type="button"
                onClick={() => {
                  setImportDialogOpen(false);
                  setImportCsv("");
                  setImportPreview([]);
                }}
                className="text-ink-3 hover:text-ink text-[12px] focus-visible:shadow-[var(--shadow-focus)] outline-none rounded-sm"
                aria-label="Close dialog"
              >
                close
              </button>
            </header>
            <div className="panel-body flex flex-col gap-3">
              <input
                type="file"
                accept=".csv,text/csv"
                ref={fileInputRef}
                onChange={onImportFile}
                className="hidden"
                aria-label="Choose CSV file"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose file…
              </Button>
              <div className="flex flex-col gap-1">
                <label className="t-caption">
                  Or paste CSV (one pattern per line, first column):
                </label>
                <textarea
                  value={importCsv}
                  onChange={(e) => onImportCsvChange(e.target.value)}
                  rows={6}
                  spellCheck={false}
                  placeholder={"pattern\n*@example.com\nsomeone@acme.com"}
                  aria-label="CSV content"
                  className="rounded-sm border border-line bg-canvas px-2.5 py-2 font-mono text-[12px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-line-strong focus:shadow-[var(--shadow-focus)] transition-[border-color,box-shadow] resize-none"
                />
              </div>
              {importPreview.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="t-caption">
                    {importPreview.length} pattern(s) parsed — duplicates
                    skipped:
                  </p>
                  <ul className="max-h-40 overflow-auto border border-line rounded-sm divide-y divide-line">
                    {importPreview.map((p, i) => (
                      <li
                        key={i}
                        className="px-2.5 py-1.5 font-mono text-[12px] text-ink"
                      >
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-2 justify-end pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImportDialogOpen(false);
                    setImportCsv("");
                    setImportPreview([]);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={importPending || importPreview.length === 0}
                  loading={importPending}
                  onClick={onImportSubmit}
                >
                  Import {importPreview.length > 0
                    ? `${importPreview.length} pattern(s)`
                    : ""}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
