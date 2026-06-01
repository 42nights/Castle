"use client";

import { Chip } from "@/components/ui/badge";
import type { CustomerRow } from "@/lib/derive";

export type CustomerFilter = "all" | "active" | "at-risk" | "paused" | "churned";

interface CustomerFilterChipsProps {
  rows: CustomerRow[];
  active: CustomerFilter;
  onChange: (f: CustomerFilter) => void;
}

/**
 * Status filter chips for /customers list.
 * Shows counts per bucket derived from the rows.
 */
export function CustomerFilterChips({
  rows,
  active: current,
  onChange,
}: CustomerFilterChipsProps) {
  const counts = {
    all: rows.length,
    active: rows.filter((r) => r.customer.status === "active" && r.customer.health !== "red").length,
    "at-risk": rows.filter(
      (r) => r.customer.health === "red" || (r.customer.health === "yellow" && r.customer.status !== "churned")
    ).length,
    paused: rows.filter((r) => r.customer.status === "paused").length,
    churned: rows.filter((r) => r.customer.status === "churned").length,
  };

  const filters: { key: CustomerFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "at-risk", label: "At risk" },
    { key: "paused", label: "Paused" },
    { key: "churned", label: "Churned" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 mb-5" role="group" aria-label="Filter customers by status">
      {filters.map((f) => (
        <Chip
          key={f.key}
          active={current === f.key}
          onClick={() => onChange(f.key)}
          aria-pressed={current === f.key}
        >
          {f.label}
          <span className="num ml-1 text-xs opacity-60">{counts[f.key]}</span>
        </Chip>
      ))}
    </div>
  );
}
