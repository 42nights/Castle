"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Avatar, HealthPip } from "@/components/atoms";
import { DataTable } from "@/components/data-table";
import type { FdeRow } from "@/lib/derive";
import { formatHours, formatPct } from "@/lib/format";

export function FdesTable({ rows }: { rows: FdeRow[] }) {
  const columns: ColumnDef<FdeRow>[] = [
    {
      id: "name",
      header: "Name",
      accessorFn: (r) => r.fde.name,
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-3">
          <Avatar name={row.original.fde.name} />
          <span className="text-ink">{row.original.fde.name}</span>
        </span>
      ),
    },
    {
      id: "role",
      header: "Role",
      accessorFn: (r) => r.fde.role,
      cell: ({ row }) => (
        <span className="text-ink-2 text-[13px]">{row.original.fde.role}</span>
      ),
      filterFn: (row, _id, value) => {
        if (value === "founder") return row.original.fde.is_founder;
        if (value === "hire") return !row.original.fde.is_founder;
        return row.original.fde.role === value;
      },
    },
    {
      id: "active",
      header: "Active eng",
      accessorFn: (r) => r.workload.activeEngagements.length,
      cell: ({ row }) => (
        <span className="num text-ink-2 text-right block">
          {row.original.workload.activeEngagements.length}
        </span>
      ),
    },
    {
      id: "utilization",
      header: "Utilization",
      accessorFn: (r) => r.workload.utilization,
      cell: ({ row }) => (
        <span
          className={[
            "num text-right block",
            row.original.workload.status === "overcommitted"
              ? "text-accent"
              : "text-ink-2",
          ].join(" ")}
        >
          {formatPct(row.original.workload.utilization)}
        </span>
      ),
    },
    {
      id: "hours",
      header: "Hrs this wk",
      accessorFn: (r) => r.fde.hours_this_week,
      cell: ({ row }) => (
        <span className="num text-ink-2 text-right block">
          {formatHours(row.original.fde.hours_this_week)}
        </span>
      ),
    },
    {
      id: "shipped",
      header: "Agents shipped",
      accessorFn: (r) => r.fde.agents_shipped_total,
      cell: ({ row }) => (
        <span className="num text-ink-2 text-right block">
          {row.original.fde.agents_shipped_total}
        </span>
      ),
    },
    {
      id: "tpl",
      header: "Templates",
      accessorFn: (r) => r.fde.templates_authored,
      cell: ({ row }) => (
        <span className="num text-ink-2 text-right block">
          {row.original.fde.templates_authored}
        </span>
      ),
    },
    {
      id: "avgHealth",
      header: "Avg portfolio health",
      accessorFn: (r) => r.workload.avgPortfolioHealth,
      cell: ({ row }) => (
        <HealthPip
          value={row.original.workload.avgPortfolioHealth}
          label={
            row.original.workload.avgPortfolioHealth === "—"
              ? "no active"
              : row.original.workload.avgPortfolioHealth
          }
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      defaultSort={[{ id: "utilization", desc: true }]}
      searchColumnId="name"
      searchPlaceholder="Search FDE…"
      filters={[
        {
          id: "role",
          label: "All roles",
          options: [
            { label: "Founders", value: "founder" },
            { label: "Hires", value: "hire" },
            { label: "Founder role", value: "Founder" },
            { label: "Senior FDE", value: "Senior FDE" },
            { label: "FDE", value: "FDE" },
            { label: "Junior FDE", value: "Junior FDE" },
          ],
        },
      ]}
      rowHref={(r) => `/fdes/${r.fde.id}`}
      urlKey="fde"
    />
  );
}
