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
  const totalReuses = usage.reduce((s, u) => s + u.reuseCount, 0);

  return (
    <div
      className="rounded-lg bg-canvas shadow-[var(--shadow-base)] overflow-hidden"
      aria-label="Template overview — most reused"
    >
      <header className="flex items-baseline justify-between px-4 py-3 border-b border-line">
        <h2 className="t-h2">
          Templates
          <span className="ml-2 font-mono tabular-nums text-ink-3">
            {usage.length}
          </span>
        </h2>
        <Link
          href="/templates"
          className="text-[12px] text-ink-3 hover:text-ink transition-colors duration-instant"
        >
          library
        </Link>
      </header>

      {totalReuses > 0 && (
        <div className="px-4 py-2.5 border-b border-line text-[12px] text-ink-3">
          <span className="font-mono tabular-nums text-ink">{totalReuses}</span>{" "}
          total reuses across{" "}
          <span className="font-mono tabular-nums text-ink">{usage.length}</span>{" "}
          templates
        </div>
      )}

      <ol>
        {ranked.map((u, i) => {
          const origin = cById.get(u.template.origin_customer_id);
          const isFeatured = u.reuseCount >= 5;
          return (
            <li
              key={u.template.id}
              className={`hover:bg-surface-1 transition-colors duration-instant ${
                i > 0 ? "border-t border-line" : ""
              } ${isFeatured ? "bg-accent-soft/30" : ""}`}
            >
              <Link
                href={`/templates/${u.template.id}`}
                className="group block px-4 py-2.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] text-ink group-hover:underline underline-offset-2 decoration-line/40 truncate">
                    {u.template.name}
                  </span>
                  <span className="t-eyebrow shrink-0">{u.template.category}</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1.5 text-[12px] text-ink-3">
                  <span
                    className={`font-mono tabular-nums font-medium ${
                      isFeatured ? "text-accent" : "text-ink-2"
                    }`}
                  >
                    {u.reuseCount}
                  </span>
                  <span>{u.reuseCount === 1 ? "reuse" : "reuses"}</span>
                  {origin && <span>from {origin.name}</span>}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
