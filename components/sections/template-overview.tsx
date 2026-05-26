import Link from "next/link";
import type { TemplateUsage } from "@/lib/derive";
import { templatesByMostReused } from "@/lib/derive";
import type { Customer } from "@/lib/types";

export function TemplateOverview({
  usage,
  customers,
  limit = 5,
}: {
  usage: TemplateUsage[];
  customers: Customer[];
  limit?: number;
}) {
  const ranked = templatesByMostReused(usage).slice(0, limit);
  const cById = new Map(customers.map((c) => [c.id, c]));
  const totalReuses = usage.reduce((s, u) => s + u.customerCount, 0);

  return (
    <div className="rounded-lg bg-surface border border-line overflow-hidden">
      <header className="flex items-baseline justify-between px-4 py-3 border-b border-line">
        <h2 className="t-h2">
          Templates
          <span className="ml-2 num text-ink-3">{usage.length}</span>
        </h2>
        <Link
          href="/templates"
          className="text-[12px] text-ink-3 hover:text-ink transition-colors"
        >
          library
        </Link>
      </header>

      {totalReuses > 0 && (
        <div className="px-4 py-2.5 border-b border-line text-[12px] text-ink-3">
          <span className="num text-ink">{totalReuses}</span> total reuses across{" "}
          <span className="num text-ink">{usage.length}</span> templates
        </div>
      )}

      <ol>
        {ranked.map((u, i) => {
          const origin = cById.get(u.template.origin_customer_id);
          return (
            <li
              key={u.template.id}
              className={`px-4 py-2.5 hover:bg-surface-2 transition-colors ${i > 0 ? "border-t border-line" : ""}`}
            >
              <Link href={`/templates/${u.template.id}`} className="group block">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] text-ink group-hover:underline truncate">
                    {u.template.name}
                  </span>
                  <span className="text-[11px] text-ink-3 uppercase tracking-wide shrink-0">
                    {u.template.category}
                  </span>
                </div>
                <div className="mt-1 text-[12px] text-ink-3">
                  <span className="num text-ink-2">{u.customerCount}</span> reuses
                  {origin && (
                    <span className="ml-1">from {origin.name}</span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
