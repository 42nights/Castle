import Link from "next/link";
import type { Customer, PatternExtraction, Template } from "@/lib/types";
import { formatDate } from "@/lib/format";

/**
 * Pattern extraction timeline.
 *
 * Ledger of "From X → built as T → reused at N customers". Date
 * sits in the left margin like a journal entry; the prose flows in
 * the main column.
 */
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
    <section className="panel mb-4">
      <header className="panel-header">
        <h2 className="t-h2 text-ink">Patterns extracted</h2>
        {showLinkAll && (
          <Link
            href="/extractions"
            className="text-[12px] text-ink-3 hover:text-ink"
          >
            all extractions →
          </Link>
        )}
      </header>

      <ol className="ledger">
        {shown.map((p) => {
          const src = cById.get(p.source_customer_id);
          const tpl = tById.get(p.extracted_into_template_id);
          const reused = p.reused_at_customer_ids
            .map((id) => cById.get(id))
            .filter(Boolean) as Customer[];
          return (
            <li
              key={p.id}
              className="px-3 py-2.5 grid md:grid-cols-[88px_1fr] gap-4"
            >
              <div className="num text-[11px] text-ink-3 pt-[3px]">
                {formatDate(p.extracted_at)}
              </div>
              <div className="min-w-0">
                <div className="text-[14.5px] leading-snug text-ink">
                  <Link
                    href={`/customers/${src?.id ?? ""}`}
                    className="hover:underline"
                  >
                    {src?.name ?? "—"}
                  </Link>
                  <span className="text-ink-3"> needed something. We built it as </span>
                  {tpl ? (
                    <Link
                      href={`/templates/${tpl.id}`}
                      className="hover:underline"
                    >
                      {tpl.name}
                    </Link>
                  ) : (
                    <span className="text-ink-3 italic">a since-removed template</span>
                  )}
                  <span className="text-ink-3">. Now used at </span>
                  <span className="num">{reused.length}</span>{" "}
                  <span className="text-ink-3">
                    other{reused.length === 1 ? "" : "s"}.
                  </span>
                </div>
                {reused.length > 0 && (
                  <p className="mt-1 text-[12.5px] text-ink-3">
                    {reused.map((c) => c.name).join(", ")}
                  </p>
                )}
                <p className="mt-2 text-[13px] leading-relaxed text-ink-2 max-w-2xl">
                  {p.source_engagement_summary}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
