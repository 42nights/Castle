"use client";

import { Search, X } from "lucide-react";
import type { TemplateCategory } from "@/lib/types";

export type SortKey = "reused" | "newest" | "oldest" | "alpha";

const CATEGORIES: TemplateCategory[] = ["GTM", "Ops", "Content", "BD", "Research"];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "reused", label: "Most reused" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "alpha", label: "A → Z" },
];

export type FilterState = {
  category: TemplateCategory | "all";
  sort: SortKey;
  search: string;
};

export function TemplateFilters({
  value,
  onChange,
}: {
  value: FilterState;
  onChange: (next: FilterState) => void;
}) {
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-2 mb-8" role="toolbar" aria-label="Template filters">
      {/* All categories chip */}
      <Chip
        active={value.category === "all"}
        onClick={() => set({ category: "all" })}
      >
        All
      </Chip>

      {/* Category chips */}
      {CATEGORIES.map((cat) => (
        <Chip
          key={cat}
          active={value.category === cat}
          onClick={() => set({ category: value.category === cat ? "all" : cat })}
        >
          {cat}
        </Chip>
      ))}

      {/* Sort chips */}
      <span className="w-px h-4 bg-line mx-0.5 shrink-0" aria-hidden />
      {SORT_OPTIONS.slice(0, 2).map((opt) => (
        <Chip
          key={opt.value}
          active={value.sort === opt.value}
          onClick={() => set({ sort: opt.value })}
        >
          {opt.label}
        </Chip>
      ))}

      {/* Text search */}
      <div className="ml-auto relative flex items-center min-w-0">
        <Search
          size={13}
          className="absolute left-2.5 text-ink-3 pointer-events-none"
          aria-hidden
        />
        <input
          type="search"
          value={value.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search templates…"
          aria-label="Search templates by name, capability, or tag"
          className={[
            "h-8 pl-8 pr-8 rounded-sm border border-line bg-canvas text-sm text-ink",
            "placeholder:text-ink-4 shadow-[var(--shadow-xs)]",
            "hover:border-line-strong",
            "focus:outline-none focus:border-line-focus focus:shadow-[var(--shadow-focus)]",
            "transition-[border-color,box-shadow] duration-quick w-48",
          ].join(" ")}
        />
        {value.search && (
          <button
            type="button"
            onClick={() => set({ search: "" })}
            aria-label="Clear search"
            className="absolute right-2 text-ink-3 hover:text-ink transition-colors duration-instant"
          >
            <X size={12} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-7 px-3 rounded-full text-[12.5px] font-medium border transition-colors duration-instant",
        "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
        active
          ? "bg-ink text-paper border-ink"
          : "bg-canvas text-ink-2 border-line hover:text-ink hover:border-line-strong hover:bg-surface-1",
      ].join(" ")}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
