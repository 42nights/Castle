import Link from "next/link";
import { CategoryBadge } from "@/components/atoms";
import type { TemplateUsage } from "@/lib/derive";
import { templatesByMostReused } from "@/lib/derive";
import type { Customer } from "@/lib/types";

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
    <section className="mb-14">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="t-eyebrow mb-2">— Agent template library</div>
          <h2 className="t-h2 text-ink">What we&rsquo;ve productized so far.</h2>
        </div>
        <Link
          href="/templates"
          className="t-caption text-ink-2 hover:text-ink"
        >
          all templates →
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-line border border-line rounded-sm overflow-hidden">
        {ranked.map((u) => {
          const origin = cById.get(u.template.origin_customer_id);
          return (
            <Link
              key={u.template.id}
              href={`/templates/${u.template.id}`}
              className="group bg-page p-5 hover:bg-surface transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="t-h3">{u.template.name}</div>
                <CategoryBadge category={u.template.category} />
              </div>
              <ul className="mt-3 space-y-1 text-[13px] text-ink-2">
                {u.template.capabilities.slice(0, 3).map((cap) => (
                  <li key={cap} className="flex gap-2">
                    <span className="text-ink-3">·</span>
                    <span>{cap}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-3 border-t border-line t-caption flex items-center justify-between">
                <span>
                  <span className="num text-ink">{u.customerCount}</span>{" "}
                  customers ·{" "}
                  <span className="num text-ink">{u.deploymentCount}</span>{" "}
                  deployments
                </span>
                <span className="text-ink-3">
                  from {origin?.name ?? "—"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
