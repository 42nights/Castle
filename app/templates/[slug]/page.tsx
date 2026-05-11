import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryBadge } from "@/components/atoms";
import { CapabilityEditor } from "@/components/controls/capability-editor";
import { InlineName } from "@/components/controls/inline-name";
import { PageHeader, PageShell, SectionHeader } from "@/components/page-shell";
import { loadOverview } from "@/lib/load-overview";
import { formatDate, formatHours } from "@/lib/format";

export default async function TemplateDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { templates, customers, deployments, fdes, patternExtractions } =
    await loadOverview();
  const tpl = templates.find((t) => t.id === slug);
  if (!tpl) notFound();
  const origin = customers.find((c) => c.id === tpl.origin_customer_id);
  const author = fdes.find((f) => f.id === tpl.authored_by_fde_id);
  const cById = new Map(customers.map((c) => [c.id, c]));
  const deps = deployments.filter((d) => d.template_id === tpl.id);
  const customerCount = new Set(deps.map((d) => d.customer_id)).size;
  const relatedExtractions = patternExtractions.filter(
    (p) => p.extracted_into_template_id === tpl.id
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow={
          <Link href="/templates" className="hover:text-ink">
            ← Templates
          </Link>
        }
        title={
          <InlineName
            kind="template"
            slug={tpl.id}
            current={tpl.name}
            className="t-h1 text-ink"
          />
        }
        description={
          <>
            Authored{" "}
            <span className="num text-ink">{formatDate(tpl.created_at)}</span>{" "}
            by{" "}
            <Link
              href={`/fdes/${author?.id ?? ""}`}
              className="text-ink hover:underline"
            >
              {author?.name ?? "—"}
            </Link>{" "}
            from work with{" "}
            <Link
              href={`/customers/${origin?.id ?? ""}`}
              className="text-ink hover:underline"
            >
              {origin?.name ?? "—"}
            </Link>
            .
          </>
        }
        actions={<CategoryBadge category={tpl.category} />}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6 border-y border-line py-6 mb-14">
        <Field
          label="Deployments"
          value={<span className="num text-ink t-h3">{deps.length}</span>}
        />
        <Field
          label="Unique customers"
          value={<span className="num text-ink t-h3">{customerCount}</span>}
        />
        <Field
          label="Hours replaced / wk"
          value={
            <span className="num text-ink t-h3">
              {formatHours(deps.reduce((s, d) => s + d.hours_replaced_per_week, 0))}
            </span>
          }
        />
        <Field
          label="Avg customization"
          value={
            <span className="num text-ink t-h3">
              {deps.length === 0
                ? "—"
                : `${Math.round(
                    deps.reduce((s, d) => s + d.customization_pct, 0) /
                      deps.length
                  )}%`}
            </span>
          }
        />
      </section>

      <section className="grid md:grid-cols-[240px_1fr] gap-10 mb-16">
        <div>
          <div className="t-eyebrow mb-2">— Capabilities</div>
          <h2 className="t-h2 text-ink">What this template does.</h2>
          <p className="mt-3 text-ink-2 text-[13px] leading-relaxed">
            Click a row to edit. Use ↑↓ to reorder.
          </p>
        </div>
        <div>
          <CapabilityEditor
            templateSlug={tpl.id}
            fallback={tpl.capabilities}
          />
        </div>
      </section>

      <section className="mb-16">
        <SectionHeader
          eyebrow="— Deployments"
          title="Where this template is running."
        />
        {deps.length === 0 ? (
          <p className="text-ink-3 text-sm">Nothing deployed from this template yet.</p>
        ) : (
          <div className="border-t border-b border-line">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line text-ink-3 uppercase tracking-[0.06em] text-[10px]">
                  <th className="text-left h-9 px-3 font-medium">Customer</th>
                  <th className="text-left h-9 px-3 font-medium">Agent name</th>
                  <th className="text-right h-9 px-3 font-medium">Custom %</th>
                  <th className="text-right h-9 px-3 font-medium">Hrs / wk</th>
                  <th className="text-right h-9 px-3 font-medium">Deployed</th>
                </tr>
              </thead>
              <tbody>
                {deps.map((d) => {
                  const c = cById.get(d.customer_id);
                  return (
                    <tr key={d.id} className="border-b border-line last:border-b-0">
                      <td className="px-3 py-3">
                        <Link
                          href={`/customers/${c?.id ?? ""}`}
                          className="text-ink hover:underline"
                        >
                          {c?.name ?? "—"}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-ink-2">{d.agent_name}</td>
                      <td className="px-3 py-3 num text-right text-ink-2">
                        {d.customization_pct}%
                      </td>
                      <td className="px-3 py-3 num text-right text-ink-2">
                        {formatHours(d.hours_replaced_per_week)}
                      </td>
                      <td className="px-3 py-3 num text-right text-ink-3">
                        {formatDate(d.deployed_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {relatedExtractions.length > 0 && (
        <section>
          <SectionHeader
            eyebrow="— Extraction history"
            title="Where this template came from."
          />
          <ul className="border-t border-line">
            {relatedExtractions.map((p) => (
              <li key={p.id} className="border-b border-line py-4">
                <div className="t-caption num text-ink-3 mb-1">
                  {formatDate(p.extracted_at)}
                </div>
                <p className="text-[14px] text-ink leading-relaxed">
                  {p.source_engagement_summary}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageShell>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="t-caption mb-2">{label}</div>
      <div className="text-ink">{value}</div>
    </div>
  );
}
