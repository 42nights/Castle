"use client";

import { cn } from "@/lib/utils";

type ViewMode = "grouped" | "flat";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}

/**
 * Grouped vs flat table toggle for /engagements list.
 */
export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="Table view mode"
      className="inline-flex h-7 rounded-sm border border-line overflow-hidden text-[12px]"
    >
      <button
        type="button"
        onClick={() => onChange("grouped")}
        aria-pressed={value === "grouped"}
        className={cn(
          "px-3 transition-colors duration-instant outline-none focus-visible:bg-surface-2",
          value === "grouped"
            ? "bg-ink text-paper"
            : "bg-canvas text-ink-2 hover:bg-surface-1",
        )}
      >
        By phase
      </button>
      <button
        type="button"
        onClick={() => onChange("flat")}
        aria-pressed={value === "flat"}
        className={cn(
          "px-3 border-l border-line transition-colors duration-instant outline-none focus-visible:bg-surface-2",
          value === "flat"
            ? "bg-ink text-paper"
            : "bg-canvas text-ink-2 hover:bg-surface-1",
        )}
      >
        Flat
      </button>
    </div>
  );
}
