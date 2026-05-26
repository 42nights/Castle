import Link from "next/link";
import type { Customer, PatternExtraction, Template } from "@/lib/types";
import { formatDate } from "@/lib/format";

export function ExtractionTimeline({
  extractions,
  customers,
  templates,
  limit,
  showLinkAll = false,
}: {
  extractions: PatternExtraction[];
  customers: Customer[];
  templates: Template[];
  limit?: number;
  showLinkAll?: boolean;
}) {
  const cById = new Map(customers.map((c) => [c.id, c]));
  const tById = new Map(templates.map((t) => [t.id, t]));
  const list = [...extractions].sort((a, b) =>
    b.extracted_at.localeCompare(a.extracted_at),
  );
  const shown = limit ? list.slice(0, limit) : list;

  return (
    <div className="rounded-lg bg-surface border border-line overflow-hidden">
      <header className="flex items-baseline justify-between px-4 py-3 border-b border-line">
        <h2 className="t-h2">Flywheel</h2>
        {showLinkAll && (
          <Link
            href="/extractions"
            className="text-[12px] text-ink-3 hover:text-ink transition-colors"
          >
            all
          </Link>
        )}
      </header>

      <ol>
        {shown.map((p, i) => {
          const src = cById.get(p.source_customer_id);
          const tpl = tById.get(p.extracted_into_template_id);
          const reused = p.reused_at_customer_ids
            .map((id) => cById.get(id))
            .filter(Boolean) as Customer[];
          return (
            <li
              key={p.id}
              className={`px-4 py-3 ${i > 0 ? "border-t border-line" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <div className="text-[13px] text-ink leading-snug">
                  {src?.id ? (
                    <Link
                      href={`/customers/${src.id}`}
                      className="hover:underline"
                    >
                      {src?.name ?? "Unknown"}
                    </Link>
                  ) : (
                    <span>{src?.name ?? "Unknown"}</span>
                  )}
                  <span className="text-ink-3 mx-1.5">-&gt;</span>
                  {tpl ? (
                    <Link
                      href={`/templates/${tpl.id}`}
                      className="hover:underline"
                    >
                      {tpl.name}
                    </Link>
                  ) : (
                    <span className="text-ink-3">removed</span>
                  )}
                </div>
                <span className="num text-[11px] text-ink-3 shrink-0">
                  {formatDate(p.extracted_at)}
                </span>
              </div>
              {reused.length > 0 && (
                <div className="text-[12px] text-ink-3">
                  Reused at <span className="num text-ink-2">{reused.length}</span>{" "}
                  {reused.length === 1 ? "customer" : "customers"}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
