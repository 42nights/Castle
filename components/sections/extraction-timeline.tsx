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
    b.extracted_at.localeCompare(a.extracted_at)
  );
  const shown = limit ? list.slice(0, limit) : list;

  return (
    <section className="mb-14">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="t-eyebrow mb-2">— Pattern extractions</div>
          <h2 className="t-h2 text-ink">
            One customer&rsquo;s problem becomes everyone&rsquo;s template.
          </h2>
        </div>
        {showLinkAll && (
          <Link
            href="/extractions"
            className="t-caption text-ink-2 hover:text-ink"
          >
            all extractions →
          </Link>
        )}
      </div>

      <ol className="border-t border-line">
        {shown.map((p) => {
          const src = cById.get(p.source_customer_id);
          const tpl = tById.get(p.extracted_into_template_id);
          const reused = p.reused_at_customer_ids
            .map((id) => cById.get(id))
            .filter(Boolean) as Customer[];
          return (
            <li
              key={p.id}
              className="border-b border-line py-6 grid md:grid-cols-[140px_1fr] gap-6"
            >
              <div className="t-caption num text-ink-3 pt-1">
                {formatDate(p.extracted_at)}
              </div>
              <div>
                <div className="text-[14.5px] leading-snug text-ink">
                  <span className="text-ink-3">From</span>{" "}
                  <Link
                    href={`/customers/${src?.id ?? ""}`}
                    className="text-ink hover:underline"
                  >
                    {src?.name ?? "—"}
                  </Link>{" "}
                  <span className="text-ink-3">→ extracted into</span>{" "}
                  {tpl ? (
                    <Link
                      href={`/templates/${tpl.id}`}
                      className="text-ink hover:underline"
                    >
                      {tpl.name}
                    </Link>
                  ) : (
                    <span className="text-ink-3 italic">
                      a template that no longer exists
                    </span>
                  )}{" "}
                  <span className="text-ink-3">→ reused at</span>{" "}
                  <span className="text-ink num">
                    {reused.length} customer{reused.length === 1 ? "" : "s"}
                  </span>
                  {reused.length > 0 && (
                    <span className="text-ink-3">
                      {" "}
                      ({reused.map((c) => c.name).join(", ")})
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-2 max-w-3xl">
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
