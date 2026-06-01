"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CreateEngagementDialog } from "@/components/dialogs/create-engagement-dialog";
import { ExtractPatternDialog } from "@/components/dialogs/extract-pattern-dialog";
import { LogFounderMonthDialog } from "@/components/dialogs/log-founder-month-dialog";
import { ManualAttentionDialog } from "@/components/dialogs/manual-attention-dialog";

type ActionId =
  | "new-engagement"
  | "log-month"
  | "extract"
  | "reminder"
  | "go-/"
  | "go-/engagements"
  | "go-/customers"
  | "go-/templates"
  | "go-/extractions"
  | "go-/fdes";

type Action = {
  id: ActionId;
  label: string;
  hint: string;
};

const ACTIONS: Action[] = [
  { id: "new-engagement", label: "+ New engagement", hint: "create a customer engagement" },
  { id: "log-month", label: "+ Log this month's founder hours", hint: "founder leverage chart" },
  { id: "extract", label: "+ Extract pattern", hint: "engagement → template" },
  { id: "reminder", label: "+ Add reminder", hint: "manual attention item" },
  { id: "go-/", label: "Go: Overview", hint: "/" },
  { id: "go-/engagements", label: "Go: Engagements", hint: "/engagements" },
  { id: "go-/customers", label: "Go: Customers", hint: "/customers" },
  { id: "go-/templates", label: "Go: Templates", hint: "/templates" },
  { id: "go-/extractions", label: "Go: Extractions", hint: "/extractions" },
  { id: "go-/fdes", label: "Go: FDEs", hint: "/fdes" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showExtract, setShowExtract] = useState(false);
  const [showReminder, setShowReminder] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Reset query + active when the palette opens (setState-during-render pattern).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQuery("");
      setActive(0);
    }
  }

  const filtered = ACTIONS.filter(
    (a) =>
      a.label.toLowerCase().includes(query.toLowerCase()) ||
      a.hint.toLowerCase().includes(query.toLowerCase()),
  );

  const run = (a: Action) => {
    setOpen(false);
    if (a.id === "new-engagement") setShowCreate(true);
    else if (a.id === "log-month") setShowLog(true);
    else if (a.id === "extract") setShowExtract(true);
    else if (a.id === "reminder") setShowReminder(true);
    else if (a.id.startsWith("go-")) router.push(a.id.slice(3));
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const a = filtered[active];
      if (a) run(a);
    }
  };

  if (!open) {
    return (
      <>
        {showCreate && (
          <CreateEngagementDialog open onClose={() => setShowCreate(false)} />
        )}
        {showLog && (
          <LogFounderMonthDialog open onClose={() => setShowLog(false)} />
        )}
        {showExtract && (
          <ExtractPatternDialog open onClose={() => setShowExtract(false)} />
        )}
        {showReminder && (
          <ManualAttentionDialog open onClose={() => setShowReminder(false)} />
        )}
      </>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[var(--z-command,60)] flex items-start justify-center pt-[15vh] px-4"
        onClick={() => setOpen(false)}
      >
        <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" />

        {/* Palette surface — bg-canvas, shadow-lg, rounded-lg */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          className="relative w-full max-w-[520px] rounded-lg bg-canvas shadow-[var(--shadow-lg)] border border-line overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="px-4 pt-4 pb-3 border-b border-line">
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onListKey}
              placeholder="Type an action…"
              aria-label="Search commands"
              className={[
                "w-full h-9 rounded-sm border border-line bg-surface-1 px-3 text-sm text-ink",
                "placeholder:text-ink-4",
                "focus:outline-none focus:border-line-focus focus:shadow-[var(--shadow-focus)]",
                "transition-[border-color,box-shadow] duration-quick",
              ].join(" ")}
            />
            <p className="mt-2 font-mono text-[11px] text-ink-4">
              ↑↓ navigate · ↵ run · Esc close
            </p>
          </div>

          {/* Results */}
          <ul
            role="listbox"
            aria-label="Commands"
            className="p-2 max-h-[320px] overflow-y-auto"
          >
            {filtered.length === 0 && (
              <li className="px-3 py-3 t-caption text-ink-3">No matches.</li>
            )}
            {filtered.map((a, i) => (
              <li key={a.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onClick={() => run(a)}
                  onMouseEnter={() => setActive(i)}
                  className={[
                    "w-full text-left px-3 py-2 rounded-sm flex items-center justify-between gap-3",
                    "transition-colors duration-instant outline-none",
                    "focus-visible:shadow-[var(--shadow-focus)]",
                    // Selected: bg-accent-soft per spec §4.5
                    i === active
                      ? "bg-accent-soft"
                      : "hover:bg-surface-1",
                  ].join(" ")}
                >
                  <span className="text-ink text-sm">{a.label}</span>
                  <span className="font-mono text-[11px] text-ink-3 shrink-0">{a.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {showCreate && (
        <CreateEngagementDialog open onClose={() => setShowCreate(false)} />
      )}
      {showLog && (
        <LogFounderMonthDialog open onClose={() => setShowLog(false)} />
      )}
      {showExtract && (
        <ExtractPatternDialog open onClose={() => setShowExtract(false)} />
      )}
      {showReminder && (
        <ManualAttentionDialog open onClose={() => setShowReminder(false)} />
      )}
    </>
  );
}
