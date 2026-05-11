"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { CustomerHealthMenu } from "@/components/controls/customer-health-menu";
import { CustomerStatusMenu } from "@/components/controls/customer-status-menu";
import { MrrInput } from "@/components/controls/mrr-input";
import type { CustomerRow } from "@/lib/derive";
import { formatHours, formatPct } from "@/lib/format";

export function CustomersTable({ rows }: { rows: CustomerRow[] }) {
  const backers = Array.from(
    new Set(rows.flatMap((r) => r.customer.backed_by))
  ).filter((b) => b !== "—");

  const columns: ColumnDef<CustomerRow>[] = [
    {
      id: "name",
      header: "Name",
      accessorFn: (r) => r.customer.name,
      cell: ({ row }) => (
        <span className="text-ink">{row.original.customer.name}</span>
      ),
    },
    {
      id: "backer",
      header: "Backed by",
      accessorFn: (r) => r.customer.backed_by.join(", "),
      cell: ({ row }) => (
        <span className="text-ink-2 text-[13px]">
          {row.original.customer.backed_by.join(", ")}
        </span>
      ),
      filterFn: (row, _id, value) => {
        if (!value) return true;
        if (value === "PE") return row.original.customer.is_pe;
        if (value === "VC") return !row.original.customer.is_pe;
        return row.original.customer.backed_by.includes(value as string);
      },
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (r) => r.customer.status,
      cell: ({ row }) => (
        <CustomerStatusMenu
          customerSlug={row.original.customer.id}
          current={row.original.customer.status}
        />
      ),
      filterFn: (row, _id, value) => row.original.customer.status === value,
    },
    {
      id: "health",
      header: "Health",
      accessorFn: (r) => r.customer.health,
      cell: ({ row }) => (
        <CustomerHealthMenu
          customerSlug={row.original.customer.id}
          current={row.original.customer.health}
        />
      ),
      filterFn: (row, _id, value) => row.original.customer.health === value,
    },
    {
      id: "mrr",
      header: "MRR",
      accessorFn: (r) => r.customer.current_mrr,
      cell: ({ row }) => (
        <div className="text-right">
          <MrrInput
            customerSlug={row.original.customer.id}
            current={row.original.customer.current_mrr}
          />
        </div>
      ),
    },
    {
      id: "agents",
      header: "Active agents",
      accessorFn: (r) => r.activeAgents,
      cell: ({ row }) => (
        <span className="num text-ink-2 text-right block">
          {row.original.activeAgents}
        </span>
      ),
    },
    {
      id: "pct",
      header: "% template",
      accessorFn: (r) => r.templateBasedPct,
      cell: ({ row }) => (
        <span className="num text-ink-2 text-right block">
          {row.original.activeAgents === 0
            ? "—"
            : formatPct(row.original.templateBasedPct)}
        </span>
      ),
    },
    {
      id: "hours",
      header: "Hrs replaced / wk",
      accessorFn: (r) => r.hoursReplacedPerWeek,
      cell: ({ row }) => (
        <span className="num text-ink-2 text-right block">
          {row.original.hoursReplacedPerWeek === 0
            ? "—"
            : formatHours(row.original.hoursReplacedPerWeek)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      defaultSort={[{ id: "mrr", desc: true }]}
      searchColumnId="name"
      searchPlaceholder="Search customer…"
      filters={[
        {
          id: "status",
          label: "All statuses",
          options: [
            { label: "Active", value: "active" },
            { label: "Paused", value: "paused" },
            { label: "Churned", value: "churned" },
          ],
        },
        {
          id: "health",
          label: "All health",
          options: [
            { label: "Red", value: "red" },
            { label: "Yellow", value: "yellow" },
            { label: "Green", value: "green" },
          ],
        },
        {
          id: "backer",
          label: "All backers",
          options: [
            { label: "PE firms", value: "PE" },
            { label: "VC-backed", value: "VC" },
            ...backers.map((b) => ({ label: b, value: b })),
          ],
        },
      ]}
      rowHref={(r) => `/customers/${r.customer.id}`}
      urlKey="cust"
      emptyContent={
        <span>
          No customers yet — click <span className="t-mono">+ New customer</span> above.
        </span>
      }
    />
  );
}
