"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CreateEngagementDialog } from "@/components/dialogs/create-engagement-dialog";
import { ExtractPatternDialog } from "@/components/dialogs/extract-pattern-dialog";
import { LogFounderMonthDialog } from "@/components/dialogs/log-founder-month-dialog";
import { ManualAttentionDialog } from "@/components/dialogs/manual-attention-dialog";
import { Dialog } from "@/components/ui/dialog";

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

  const filtered = ACTIONS.filter((a) =>
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

  return (
    <>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Quick actions"
        description="⌘K to open, ↑↓ to navigate, ↵ to run."
        size="md"
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onListKey}
          placeholder="Type an action…"
          className="w-full h-10 rounded-sm border border-line bg-page px-3 text-[14px] focus:outline-none focus:ring-1 focus:ring-ink"
        />
        <ul className="mt-3 max-h-[280px] overflow-y-auto -mx-2">
          {filtered.length === 0 && (
            <li className="px-3 py-4 t-caption text-ink-3">No matches.</li>
          )}
          {filtered.map((a, i) => (
            <li key={a.id}>
              <button
                onClick={() => run(a)}
                onMouseEnter={() => setActive(i)}
                className={`w-full text-left px-3 py-2 rounded-sm flex items-center justify-between gap-3 ${
                  i === active ? "bg-surface" : ""
                }`}
              >
                <span className="text-ink text-[13.5px]">{a.label}</span>
                <span className="t-caption text-ink-3">{a.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </Dialog>

      {showCreate && (
        <CreateEngagementDialog
          open={showCreate}
          onClose={() => setShowCreate(false)}
        />
      )}
      {showLog && (
        <LogFounderMonthDialog
          open={showLog}
          onClose={() => setShowLog(false)}
        />
      )}
      {showExtract && (
        <ExtractPatternDialog
          open={showExtract}
          onClose={() => setShowExtract(false)}
        />
      )}
      {showReminder && (
        <ManualAttentionDialog
          open={showReminder}
          onClose={() => setShowReminder(false)}
        />
      )}
    </>
  );
}
