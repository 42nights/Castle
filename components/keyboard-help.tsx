"use client";

// KeyboardHelp — §4.4 keyboard shortcuts cheat-sheet.
// Opens on `?` (when no input focused) and cmd-/.
// Uses the Dialog primitive (focus-trapped, Esc closes).
// Mount once in app/layout.tsx next to <CommandPalette />.

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";

// ---- Keyboard catalog per §4.4 ----

const SINGLE_KEY: Array<{ key: string; action: string }> = [
  { key: "/",     action: "Focus global search" },
  { key: "j",     action: "Move down in list" },
  { key: "k",     action: "Move up in list" },
  { key: "Enter", action: "Open focused row" },
  { key: "Esc",   action: "Close dialog / popover / palette" },
  { key: "?",     action: "This cheat-sheet" },
  { key: "g t",   action: "Go to Templates" },
  { key: "g c",   action: "Go to Customers" },
  { key: "g e",   action: "Go to Engagements" },
  { key: "g f",   action: "Go to FDEs" },
  { key: "g x",   action: "Go to Extractions" },
  { key: "g o",   action: "Go to Overview" },
  { key: "g a",   action: "Go to Assistant" },
];

const COMBOS: Array<{ key: string; action: string }> = [
  { key: "⌘K",       action: "Open command palette" },
  { key: "⌘/",       action: "Keyboard shortcuts (this dialog)" },
  { key: "⌘↵",       action: "Submit form" },
  { key: "⌘Z",       action: "Undo last inline edit" },
  { key: "⌘⇧Z",     action: "Redo" },
  { key: "⌘⇧C",     action: "Copy deep-link to current entity" },
  { key: "⌘S",       action: "Save (on editing surfaces)" },
];

// Render a single key or combo in the Castle kbd style.
function Kbd({ children }: { children: string }) {
  const keys = children.split(" ");
  return (
    <span className="inline-flex items-center gap-0.5">
      {keys.map((k, i) => (
        <kbd
          key={i}
          className={[
            "inline-flex items-center justify-center",
            "font-mono text-[11px] text-ink-2",
            "bg-surface-1 border border-line rounded-sm",
            "min-w-[22px] h-[22px] px-1",
          ].join(" ")}
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}

function ShortcutTable({
  rows,
}: {
  rows: Array<{ key: string; action: string }>;
}) {
  return (
    <table className="w-full text-sm border-separate border-spacing-y-0.5">
      <tbody>
        {rows.map(({ key, action }) => (
          <tr key={key} className="group">
            <td className="pr-6 py-1 align-middle w-px whitespace-nowrap">
              <Kbd>{key}</Kbd>
            </td>
            <td className="py-1 align-middle text-ink-2">{action}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function KeyboardHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // cmd-/ (with or without shift on some keyboards)
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }

      // `?` — only when no input/textarea/contenteditable is focused
      if (e.key === "?" && !isInputFocused()) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="Keyboard shortcuts"
      description="Press ? or ⌘/ to toggle this panel."
      size="md"
    >
      <div className="space-y-6">
        <section>
          <h3 className="t-eyebrow mb-3">Single key (when no input focused)</h3>
          <ShortcutTable rows={SINGLE_KEY} />
        </section>

        <div className="h-px bg-line" />

        <section>
          <h3 className="t-eyebrow mb-3">With ⌘ / Ctrl</h3>
          <ShortcutTable rows={COMBOS} />
        </section>
      </div>
    </Dialog>
  );
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}
