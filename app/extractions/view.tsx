"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import type { Customer, PatternExtraction, Template } from "@/lib/types";
import { formatDate } from "@/lib/format";

type Row = {
  extraction: PatternExtraction;
  source: Customer | undefined;
  template: Template | undefined;
  reused: Customer[];
};

export function ExtractionsView({
  extractions,
  customers,
  templates,
}: {
  extractions: PatternExtraction[];
  customers: Customer[];
  templates: Template[];
}) {
  const cById = new Map(customers.map((c) => [c.id, c]));
  const tById = new Map(templates.map((t) => [t.id, t]));

  const rows: Row[] = extractions
    .map((p) => ({
      extraction: p,
      source: cById.get(p.source_customer_id),
      template: tById.get(p.extracted_into_template_id),
      reused: p.reused_at_customer_ids
        .map((id) => cById.get(id))
        .filter(Boolean) as Customer[],
    }));

  const columns: ColumnDef<Row>[] = [
    {
      id: "date",
      header: "Date",
      accessorFn: (r) => r.extraction.extracted_at,
      cell: ({ row }) => (
        <span className="num text-[12px] text-ink-3">
          {formatDate(row.original.extraction.extracted_at)}
        </span>
      ),
      sortingFn: "alphanumeric",
    },
    {
      id: "source",
      header: "Source",
      accessorFn: (r) => r.source?.name ?? "",
      cell: ({ row }) =>
        row.original.source ? (
          <Link
            href={`/customers/${row.original.source.id}`}
            className="text-ink text-[13.5px] hover:underline underline-offset-2 decoration-line"
          >
            {row.original.source.name}
          </Link>
        ) : (
          <span className="text-ink-3">—</span>
        ),
      filterFn: (row, _id, value) =>
        row.original.extraction.source_customer_id === value,
    },
    {
      id: "template",
      header: "Template",
      accessorFn: (r) => r.template?.name ?? "",
      cell: ({ row }) =>
        row.original.template ? (
          <Link
            href={`/templates/${row.original.template.id}`}
            className="text-ink text-[13.5px] hover:underline underline-offset-2 decoration-line"
          >
            {row.original.template.name}
          </Link>
        ) : (
          <span className="text-ink-3">—</span>
        ),
      filterFn: (row, _id, value) =>
        row.original.extraction.extracted_into_template_id === value,
    },
    {
      id: "reused",
      header: "Reused at",
      accessorFn: (r) => r.reused.length,
      cell: ({ row }) => (
        <span className="num text-[12.5px] text-ink-2">
          {row.original.reused.length}
        </span>
      ),
    },
    {
      id: "summary",
      header: "Summary",
      accessorFn: (r) => r.extraction.source_engagement_summary,
      cell: ({ row }) => (
        <span className="text-[12.5px] text-ink-2 line-clamp-1">
          {row.original.extraction.source_engagement_summary}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      defaultSort={[{ id: "date", desc: true }]}
      urlKey="ext"
      filters={[
        {
          id: "template",
          label: "All templates",
          options: templates.map((t) => ({ label: t.name, value: t.id })),
        },
        {
          id: "source",
          label: "All sources",
          options: customers.map((c) => ({ label: c.name, value: c.id })),
        },
      ]}
      emptyContent={<span>No extractions yet.</span>}
    />
  );
}
