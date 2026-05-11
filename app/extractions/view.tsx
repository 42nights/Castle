"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Customer, PatternExtraction, Template } from "@/lib/types";
import { formatDate } from "@/lib/format";

export function ExtractionsView({
  extractions,
  customers,
  templates,
}: {
  extractions: PatternExtraction[];
  customers: Customer[];
  templates: Template[];
}) {
  const [templateFilter, setTemplateFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");

  const cById = new Map(customers.map((c) => [c.id, c]));
  const tById = new Map(templates.map((t) => [t.id, t]));

  const filtered = useMemo(() => {
    return extractions
      .filter(
        (p) =>
          !templateFilter || p.extracted_into_template_id === templateFilter
      )
      .filter((p) => !sourceFilter || p.source_customer_id === sourceFilter)
      .sort((a, b) => b.extracted_at.localeCompare(a.extracted_at));
  }, [extractions, templateFilter, sourceFilter]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <select
          value={templateFilter}
          onChange={(e) => setTemplateFilter(e.target.value)}
          className="h-8 rounded-sm border border-line bg-page px-2 text-[13px] text-ink-2 focus:outline-none focus:ring-1 focus:ring-ink"
        >
          <option value="">All templates</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="h-8 rounded-sm border border-line bg-page px-2 text-[13px] text-ink-2 focus:outline-none focus:ring-1 focus:ring-ink"
        >
          <option value="">All source customers</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="ml-auto t-caption">{filtered.length} extractions</span>
      </div>

      <ol className="relative">
        <span className="absolute left-[59px] top-2 bottom-2 w-px bg-line" aria-hidden />
        {filtered.length === 0 ? (
          <li className="text-ink-3 text-sm py-10">Nothing matches.</li>
        ) : (
          filtered.map((p) => {
            const src = cById.get(p.source_customer_id);
            const tpl = tById.get(p.extracted_into_template_id);
            const reused = p.reused_at_customer_ids
              .map((id) => cById.get(id))
              .filter(Boolean) as Customer[];
            return (
              <li
                key={p.id}
                className="relative grid grid-cols-[120px_1fr] gap-6 py-8 border-b border-line last:border-b-0"
              >
                <div className="t-caption num text-ink-3 pt-1 relative">
                  {formatDate(p.extracted_at)}
                  <span className="absolute left-[51px] top-2 h-2 w-2 rounded-full bg-accent" />
                </div>
                <div>
                  <div className="text-[14.5px] leading-snug">
                    <Link
                      href={`/customers/${src?.id ?? ""}`}
                      className="text-ink hover:underline"
                    >
                      {src?.name ?? "—"}
                    </Link>
                    <span className="text-ink-3"> needed a custom workflow</span>
                    <span className="text-ink-3 mx-1">→</span>
                    <Link
                      href={`/templates/${tpl?.id ?? ""}`}
                      className="text-ink hover:underline"
                    >
                      {tpl?.name ?? "—"}
                    </Link>
                    <span className="text-ink-3 mx-1">→</span>
                    <span className="text-ink">
                      reused at{" "}
                      <span className="num">
                        {reused.length} customer
                        {reused.length === 1 ? "" : "s"}
                      </span>
                    </span>
                  </div>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2 max-w-3xl">
                    {p.source_engagement_summary}
                  </p>
                  {reused.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 t-caption">
                      {reused.map((c) => (
                        <li key={c.id}>
                          <Link
                            href={`/customers/${c.id}`}
                            className="text-ink-2 hover:text-ink hover:underline"
                          >
                            {c.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })
        )}
      </ol>
    </>
  );
}
