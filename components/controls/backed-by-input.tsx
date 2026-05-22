"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";

/**
 * Multi-select with typed autocomplete from the union of all backers
 * across customers. Click a chip to remove. Type to filter; Enter to
 * add the highlighted suggestion, or — if no match — the literal typed
 * text. Persists the full array via `customers.setBackedBy` on every
 * change.
 *
 * Two visual modes:
 *   `mode="row"`    — inline read view, opens an editor on click.
 *                     Used in dense tables (customer list).
 *   `mode="block"`  — always-expanded chip area + input. Used on
 *                     detail pages.
 */
export function BackedByInput({
  customerSlug,
  current,
  mode = "row",
}: {
  customerSlug: string;
  current: string[];
  mode?: "row" | "block";
}) {
  const cust = useQuery(api.customers.getBySlug, { slug: customerSlug }) as
    | { _id: string }
    | null
    | undefined;
  const [actorSlug] = useActorSlug();
  const actor = useQuery(
    api.fdes.getBySlug,
    actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const known =
    (useQuery(api.customers.listBackers, {}) as string[] | undefined) ?? [];
  const run = useRunMutation(api.customers.setBackedBy);

  const [open, setOpen] = useState(mode === "block");
  const [draft, setDraft] = useState("");
  const [hi, setHi] = useState(0);
  // Suggestion-panel visibility. Separate from `open` (which gates the
  // whole editor in row mode) — `panelOpen` only controls the dropdown
  // list and closes on blur so it doesn't linger over neighboring rows.
  const [panelOpen, setPanelOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = current.filter((b) => b && b !== "—");
  const selectedSet = new Set(selected.map((s) => s.toLowerCase()));
  const q = draft.trim().toLowerCase();
  const suggestions = known
    .filter((b) => !selectedSet.has(b.toLowerCase()))
    .filter((b) => !q || b.toLowerCase().includes(q))
    .slice(0, 8);
  const hasExactMatch = suggestions.some((s) => s.toLowerCase() === q);
  const canCreate = q.length > 0 && !hasExactMatch && !selectedSet.has(q);
  const options = canCreate
    ? [...suggestions, `__create__:${draft.trim()}`]
    : suggestions;

  // Close on outside click — only for `row` mode.
  useEffect(() => {
    if (mode !== "row" || !open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mode, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => setHi(0), [draft, open]);

  const commit = async (next: string[]) => {
    if (!cust) {
      toast.error("Customer not in Convex.");
      return;
    }
    await run(
      {
        id: cust._id as never,
        backed_by: next as never,
        actor_fde_id: (actor?._id ?? null) as never,
      },
      { success: "Backers saved." },
    );
  };

  const addBacker = (value: string) => {
    const v = value.trim();
    if (!v) return;
    if (selectedSet.has(v.toLowerCase())) return;
    commit([...selected, v]);
    setDraft("");
  };

  const removeBacker = (value: string) => {
    commit(selected.filter((b) => b !== value));
  };

  const pickFromOption = (opt: string) => {
    if (opt.startsWith("__create__:")) addBacker(opt.slice("__create__:".length));
    else addBacker(opt);
  };

  // Row-mode read view.
  if (mode === "row" && !open) {
    const display = selected.length === 0 ? "—" : selected.join(", ");
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="text-left text-[13px] text-ink-2 hover:text-ink hover:bg-surface rounded-sm px-1 -mx-1 truncate max-w-[200px]"
        title="Click to edit backers"
      >
        {display}
      </button>
    );
  }

  return (
    <div
      ref={ref}
      className="relative inline-block min-w-[200px] max-w-full"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-center gap-1 rounded-sm border border-line bg-page px-1.5 py-1 focus-within:border-ink-2">
        {selected.map((b) => (
          <span
            key={b}
            className="inline-flex items-center gap-1 rounded-sm bg-surface px-1.5 py-[2px] text-[11.5px] text-ink"
          >
            {b}
            <button
              onClick={() => removeBacker(b)}
              className="text-ink-3 hover:text-accent"
              title={`Remove ${b}`}
              aria-label={`Remove ${b}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => {
            if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
            setPanelOpen(true);
          }}
          onBlur={() => {
            // Defer close so option-click handlers (mousedown happens
            // before blur, but click fires after) still land before we
            // unmount the panel.
            blurTimerRef.current = setTimeout(() => setPanelOpen(false), 150);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHi((i) => Math.min(i + 1, Math.max(0, options.length - 1)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHi((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (options[hi]) pickFromOption(options[hi]);
              else if (draft.trim()) addBacker(draft);
            } else if (e.key === "Backspace" && draft === "" && selected.length) {
              e.preventDefault();
              removeBacker(selected[selected.length - 1]);
            } else if (e.key === "Escape" && mode === "row") {
              setOpen(false);
            }
          }}
          placeholder={selected.length === 0 ? "add backer…" : ""}
          className="flex-1 min-w-[80px] bg-transparent text-[12px] text-ink placeholder:text-ink-3 outline-none px-1"
        />
      </div>

      {panelOpen && options.length > 0 && (
        <ul className="absolute left-0 top-full z-30 mt-1 w-full max-w-[280px] rounded-sm border border-line bg-page py-1 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.45)]">
          {options.map((opt, i) => {
            const isCreate = opt.startsWith("__create__:");
            const label = isCreate ? opt.slice("__create__:".length) : opt;
            return (
              <li key={opt}>
                <button
                  onMouseEnter={() => setHi(i)}
                  onClick={() => pickFromOption(opt)}
                  className={`block w-full text-left px-2.5 py-1 text-[12px] ${
                    i === hi
                      ? "bg-surface text-ink"
                      : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {isCreate ? (
                    <>
                      <span className="text-ink-3">+ add</span> "{label}"
                    </>
                  ) : (
                    label
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
