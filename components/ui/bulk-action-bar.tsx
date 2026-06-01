"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * §4.10 — Sticky bulk-action bar.
 *
 * Appears at the bottom of the viewport when 1+ rows are selected.
 * Slides in from the bottom (opacity + translateY) on mount.
 *
 * Usage:
 *   const [selected, setSelected] = React.useState<Set<string>>(new Set());
 *   <BulkActionBar
 *     count={selected.size}
 *     onClear={() => setSelected(new Set())}
 *     actions={[
 *       { label: "Set status →", items: [...], onSelect: (v) => ... },
 *       { label: "Export", onClick: () => ... },
 *       { label: "Delete", onClick: () => ..., destructive: true },
 *     ]}
 *   />
 */

export type BulkActionItem = {
  label: string;
  value?: string;
};

export type BulkAction =
  | {
      label: string;
      items: BulkActionItem[];
      onSelect: (value: string) => void;
      destructive?: false;
    }
  | {
      label: string;
      onClick: () => void;
      destructive?: boolean;
    };

interface BulkActionBarProps {
  /** Number of rows currently selected. When 0, the bar hides. */
  count: number;
  /** Called when the user clicks "Cancel" or presses Esc. */
  onClear: () => void;
  actions: BulkAction[];
  className?: string;
}

export function BulkActionBar({
  count,
  onClear,
  actions,
  className,
}: BulkActionBarProps) {
  // Close on Esc
  React.useEffect(() => {
    if (count === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClear();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [count, onClear]);

  if (count === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label={`${count} rows selected`}
      className={cn(
        // sticky bottom bar with slide-up entrance
        "fixed bottom-6 left-1/2 z-[var(--z-sticky)] -translate-x-1/2",
        "flex items-center gap-3",
        "rounded-lg bg-ink px-4 py-2.5",
        "shadow-[var(--shadow-xl)]",
        "animate-in fade-in slide-in-from-bottom-4 duration-[var(--duration-base)]",
        className,
      )}
    >
      {/* Selection count */}
      <span className="text-paper text-sm font-medium shrink-0 pr-3 border-r border-paper/20">
        {count} selected
      </span>

      {/* Actions */}
      {actions.map((action, i) => {
        if ("items" in action) {
          return (
            <BulkDropdown
              key={i}
              label={action.label}
              items={action.items}
              onSelect={action.onSelect}
            />
          );
        }
        return (
          <button
            key={i}
            type="button"
            onClick={action.onClick}
            className={cn(
              "text-sm px-2.5 py-1 rounded-sm transition-colors duration-instant outline-none",
              "focus-visible:ring-2 focus-visible:ring-paper/40",
              action.destructive
                ? "text-[#f5a89a] hover:bg-paper/10"
                : "text-paper/80 hover:text-paper hover:bg-paper/10",
            )}
          >
            {action.label}
          </button>
        );
      })}

      {/* Separator + Cancel */}
      <span className="h-4 w-px bg-paper/20 mx-0.5" aria-hidden />
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        className="text-sm text-paper/50 hover:text-paper/80 px-1.5 py-1 rounded-sm transition-colors duration-instant outline-none focus-visible:ring-2 focus-visible:ring-paper/40"
      >
        Cancel
      </button>
    </div>
  );
}

/** Internal dropdown for "Set status →" style actions */
function BulkDropdown({
  label,
  items,
  onSelect,
}: {
  label: string;
  items: BulkActionItem[];
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Close when clicking outside
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="text-sm text-paper/80 hover:text-paper px-2.5 py-1 rounded-sm transition-colors duration-instant outline-none focus-visible:ring-2 focus-visible:ring-paper/40 flex items-center gap-1.5"
      >
        {label}
        <svg
          className={cn("w-3 h-3 transition-transform duration-quick", open && "rotate-180")}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M3 4.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          className={cn(
            "absolute bottom-full mb-2 left-0 min-w-[140px]",
            "bg-canvas border border-line rounded-lg shadow-[var(--shadow-lg)] p-1",
            "z-[var(--z-overlay)]",
          )}
        >
          {items.map((item) => (
            <button
              key={item.value ?? item.label}
              role="option"
              aria-selected={false}
              type="button"
              onClick={() => {
                onSelect(item.value ?? item.label);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-sm text-sm text-ink hover:bg-surface-1 transition-colors duration-instant outline-none focus-visible:bg-surface-1"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
