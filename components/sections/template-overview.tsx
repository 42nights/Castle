import Link from "next/link";
import type { TemplateUsage } from "@/lib/derive";
import { templatesByMostReused } from "@/lib/derive";
import type { Customer } from "@/lib/types";

/**
 * Agent template library.
 *
 * Two-column ledger, not a 3-up card grid. Each template = one row:
 *
 *   [Name]                    [category]
 *   Reused by 3 customers across 4 deployments. From Customer A.
 *
 * No surrounding boxes. Hairlines between rows.
 */
export function TemplateOverview({
  usage,
  customers,
  limit = 6,
}: {
  usage: TemplateUsage[];
  customers: Customer[];
  limit?: number;
}) {
  const ranked = templatesByMostReused(usage).slice(0, limit);
  const cById = new Map(customers.map((c) => [c.id, c]));
  return (
    <section className="panel mb-4">
      <header className="panel-header">
        <h2 className="t-h2 text-ink">Library</h2>
        <Link
          href="/templates"
          className="text-[12px] text-ink-3 hover:text-ink"
        >
          all templates →
        </Link>
      </header>
      <ol className="md:grid md:grid-cols-2 md:divide-x divide-line">
        {ranked.map((u, i) => {
          const origin = cById.get(u.template.origin_customer_id);
          const lastRow = i >= ranked.length - 2;
          return (
            <li
              key={u.template.id}
              className={`px-3 py-2.5 ${lastRow ? "" : "border-b border-line"}`}
            >
              <Link
                href={`/templates/${u.template.id}`}
                className="group block"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="t-h3 text-ink group-hover:underline">
                    {u.template.name}
                  </div>
                  <span className="text-[11px] text-ink-3 uppercase tracking-[0.08em]">
                    {u.template.category}
                  </span>
                </div>
                <p className="mt-1 text-[13.5px] text-ink-2 leading-relaxed">
                  Reused at{" "}
                  <span className="num text-ink">{u.customerCount}</span>{" "}
                  {u.customerCount === 1 ? "customer" : "customers"} across{" "}
                  <span className="num text-ink">{u.deploymentCount}</span>{" "}
                  {u.deploymentCount === 1 ? "deployment" : "deployments"}.
                  From {origin?.name ?? "—"}.
                </p>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
