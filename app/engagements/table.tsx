"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import {
  AvatarGroup,
  HealthPip,
  PhaseBadge,
  ProgressBar,
} from "@/components/atoms";
import type { EngagementRow } from "@/lib/derive";
import { formatDate, formatHours } from "@/lib/format";
import type { Health } from "@/lib/types";

const healthRank: Record<Health, number> = { red: 0, yellow: 1, green: 2 };

export function EngagementsTable({ rows }: { rows: EngagementRow[] }) {
  const columns: ColumnDef<EngagementRow>[] = [
    {
      id: "customer",
      header: "Customer",
      accessorFn: (r) => r.customer.name,
      cell: ({ row }) => (
        <span className="text-ink">{row.original.customer.name}</span>
      ),
    },
    {
      id: "phase",
      header: "Phase",
      accessorFn: (r) => r.engagement.phase,
      cell: ({ row }) => <PhaseBadge phase={row.original.engagement.phase} />,
      filterFn: (row, _id, value) => row.original.engagement.phase === value,
    },
    {
      id: "progress",
      header: "Progress",
      accessorFn: (r) => r.engagement.progress_pct,
      cell: ({ row }) => (
        <div className="flex items-center gap-3 w-32">
          <ProgressBar value={row.original.engagement.progress_pct} />
          <span className="num text-ink-2 text-[12px] w-8 text-right">
            {row.original.engagement.progress_pct}%
          </span>
        </div>
      ),
    },
    {
      id: "fdes",
      header: "FDEs",
      cell: ({ row }) => (
        <AvatarGroup names={row.original.fdes.map((f) => f.name)} />
      ),
    },
    {
      id: "start",
      header: "Started",
      accessorFn: (r) => r.engagement.start_date,
      cell: ({ row }) => (
        <span className="num text-ink-2 text-[12.5px]">
          {formatDate(row.original.engagement.start_date)}
        </span>
      ),
    },
    {
      id: "end",
      header: "Expected end",
      accessorFn: (r) => r.engagement.expected_end_date,
      cell: ({ row }) => (
        <span className="num text-ink-2 text-[12.5px]">
          {formatDate(row.original.engagement.expected_end_date)}
        </span>
      ),
    },
    {
      id: "hours",
      header: "Weekly hrs",
      accessorFn: (r) => r.engagement.weekly_hours,
      cell: ({ row }) => (
        <span className="num text-ink-2">
          {formatHours(row.original.engagement.weekly_hours)}
        </span>
      ),
    },
    {
      id: "health",
      header: "Health",
      accessorFn: (r) => healthRank[r.engagement.health],
      sortingFn: (a, b, columnId) =>
        (a.getValue(columnId) as number) - (b.getValue(columnId) as number),
      cell: ({ row }) => (
        <HealthPip
          value={row.original.engagement.health}
          label={row.original.engagement.health}
        />
      ),
      filterFn: (row, _id, value) =>
        row.original.engagement.health === value,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      defaultSort={[
        { id: "health", desc: false },
        { id: "start", desc: true },
      ]}
      searchColumnId="customer"
      searchPlaceholder="Search customer…"
      filters={[
        {
          id: "phase",
          label: "All phases",
          options: [
            { label: "Discovery", value: "discovery" },
            { label: "Build", value: "build" },
            { label: "Deployed", value: "deployed" },
            { label: "Support", value: "support" },
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
      ]}
      rowHref={(r) => `/engagements/${r.engagement.id}`}
    />
  );
}
