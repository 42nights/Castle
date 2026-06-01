"use client";

import * as React from "react";
import Link from "next/link";
import { Avatar } from "@/components/atoms";
import { CustomerHealthMenu } from "@/components/controls/customer-health-menu";
import { CustomerStatusMenu } from "@/components/controls/customer-status-menu";
import { MrrInput } from "@/components/controls/mrr-input";
import { CustomerFilterChips, type CustomerFilter } from "./filter-chips";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import type { CustomerRow } from "@/lib/derive";
import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CustomersTableNewProps {
  rows: CustomerRow[];
}

/**
 * Rebuilt /customers list table.
 *
 * Changes from the original CustomersTable:
 * - 60px rows with Avatar + name stacked (operator density spec)
 * - Filter chips (All / Active / At risk / Paused / Churned) with counts
 * - Bulk-select column → BulkActionBar (sticky bottom)
 * - MRR + ARR displayed in row; health + status as inline menus
 *
 * All existing mutations (MrrInput, CustomerStatusMenu, CustomerHealthMenu)
 * are preserved exactly.
 */
export function CustomersTableNew({ rows }: CustomersTableNewProps) {
  const [filter, setFilter] = React.useState<CustomerFilter>("all");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    let out = rows;

    // Status filter
    if (filter === "active") {
      out = out.filter((r) => r.customer.status === "active" && r.customer.health !== "red");
    } else if (filter === "at-risk") {
      out = out.filter(
        (r) =>
          r.customer.health === "red" ||
          (r.customer.health === "yellow" && r.customer.status !== "churned")
      );
    } else if (filter === "paused") {
      out = out.filter((r) => r.customer.status === "paused");
    } else if (filter === "churned") {
      out = out.filter((r) => r.customer.status === "churned");
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((r) => r.customer.name.toLowerCase().includes(q));
    }

    return out;
  }, [rows, filter, search]);

  const allFilteredIds = filtered.map((r) => r.customer.id);
  const allSelected =
    allFilteredIds.length > 0 && allFilteredIds.every((id) => selected.has(id));

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      {/* Search + filter chips */}
      <div className="flex flex-wrap items-start gap-3 mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer…"
          aria-label="Search customers"
          className="h-8 w-56 rounded-sm border border-line bg-canvas px-2.5 text-[13px] placeholder:text-ink-3 focus:outline-none focus-visible:shadow-[var(--shadow-focus)] transition-shadow duration-quick"
        />
        <CustomerFilterChips rows={rows} active={filter} onChange={setFilter} />
        <span className="ml-auto t-caption self-center">{filtered.length} rows</span>
      </div>

      {/* Table */}
      <div className="border-t border-b border-line">
        <table className="w-full">
          <thead>
            <tr className="border-b border-line">
              {/* Checkbox col */}
              <th className="w-10 h-11 px-3 align-middle">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all customers"
                  className="h-3.5 w-3.5 rounded-xs border border-line-strong accent-ink cursor-pointer"
                />
              </th>
              <th className="h-11 px-3 text-left text-xs font-medium uppercase tracking-[0.06em] text-ink-3">
                Customer
              </th>
              <th className="h-11 px-3 text-left text-xs font-medium uppercase tracking-[0.06em] text-ink-3">
                Status
              </th>
              <th className="h-11 px-3 text-right text-xs font-medium uppercase tracking-[0.06em] text-ink-3">
                MRR
              </th>
              <th className="h-11 px-3 text-right text-xs font-medium uppercase tracking-[0.06em] text-ink-3 hidden md:table-cell">
                ARR
              </th>
              <th className="h-11 px-3 text-left text-xs font-medium uppercase tracking-[0.06em] text-ink-3 hidden lg:table-cell">
                Health
              </th>
              <th className="h-11 px-3 text-right text-xs font-medium uppercase tracking-[0.06em] text-ink-3 hidden lg:table-cell">
                Agents
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-14 text-center text-ink-3 text-sm">
                  {rows.length === 0
                    ? "No customers yet — click + New customer above."
                    : "No customers match."}
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const isSelected = selected.has(r.customer.id);
                return (
                  <CustomerRow
                    key={r.customer.id}
                    row={r}
                    selected={isSelected}
                    onToggle={() => toggleRow(r.customer.id)}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        actions={[
          {
            label: "Set status →",
            items: [
              { label: "Active", value: "active" },
              { label: "Paused", value: "paused" },
              { label: "Churned", value: "churned" },
            ],
            onSelect: () => {
              // Mutation wiring: operators call CustomerStatusMenu per-row for now;
              // bulk set-status is additive future work — bar provides the UI surface.
            },
          },
          {
            label: "Set health →",
            items: [
              { label: "Green", value: "green" },
              { label: "Yellow", value: "yellow" },
              { label: "Red", value: "red" },
            ],
            onSelect: () => {
              // Same as above — surface is wired, per-row mutations exist
            },
          },
          {
            label: "Export",
            onClick: () => {
              // Export selected rows as CSV
              const sel = filtered.filter((r) => selected.has(r.customer.id));
              const csv = [
                "Name,Status,Health,MRR,ARR",
                ...sel.map(
                  (r) =>
                    `${r.customer.name},${r.customer.status},${r.customer.health},${r.customer.current_mrr},${r.customer.current_mrr * 12}`
                ),
              ].join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "customers.csv";
              a.click();
              URL.revokeObjectURL(url);
            },
          },
        ]}
      />
    </div>
  );
}

/** Single 60px customer row */
function CustomerRow({
  row,
  selected,
  onToggle,
}: {
  row: CustomerRow;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <tr
      className={cn(
        "border-b border-line last:border-b-0 transition-colors duration-instant group",
        selected ? "bg-accent-soft/30" : "hover:bg-surface-1",
      )}
    >
      {/* Checkbox */}
      <td className="px-3 py-3.5 align-middle">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${row.customer.name}`}
          className="h-3.5 w-3.5 rounded-xs border border-line-strong accent-ink cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        />
      </td>

      {/* Name + avatar */}
      <td className="px-3 py-3 align-middle">
        <Link
          href={`/customers/${row.customer.id}`}
          className="inline-flex items-center gap-3 min-w-0 hover:no-underline group/link"
        >
          <Avatar name={row.customer.name} size={32} />
          <span className="font-medium text-[14px] text-ink group-hover/link:underline underline-offset-2 decoration-line">
            {row.customer.name}
          </span>
        </Link>
      </td>

      {/* Status */}
      <td className="px-3 py-3.5 align-middle">
        <CustomerStatusMenu
          customerSlug={row.customer.id}
          current={row.customer.status}
        />
      </td>

      {/* MRR */}
      <td className="px-3 py-3.5 align-middle text-right">
        <MrrInput
          customerSlug={row.customer.id}
          current={row.customer.current_mrr}
        />
      </td>

      {/* ARR */}
      <td className="px-3 py-3.5 align-middle text-right num text-ink-2 text-[13px] hidden md:table-cell">
        {formatUsd(row.customer.current_mrr * 12)}
      </td>

      {/* Health */}
      <td className="px-3 py-3.5 align-middle hidden lg:table-cell">
        <CustomerHealthMenu
          customerSlug={row.customer.id}
          current={row.customer.health}
        />
      </td>

      {/* Active agents */}
      <td className="px-3 py-3.5 align-middle text-right num text-ink-2 text-[13px] hidden lg:table-cell">
        {row.activeAgents}
      </td>
    </tr>
  );
}
