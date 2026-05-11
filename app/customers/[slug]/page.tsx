import Link from "next/link";
import { notFound } from "next/navigation";
import { HealthPip, PhaseBadge } from "@/components/atoms";
import { CustomerHealthMenu } from "@/components/controls/customer-health-menu";
import { CustomerStatusMenu } from "@/components/controls/customer-status-menu";
import { MrrInput } from "@/components/controls/mrr-input";
import { PageHeader, PageShell, SectionHeader } from "@/components/page-shell";
import { loadAll } from "@/lib/data";
import { formatDate, formatHours, formatUsd } from "@/lib/format";

export default async function CustomerDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const {
    customers,
    engagements,
    deployments,
    templates,
    patternExtractions,
  } = loadAll();
  const customer = customers.find((c) => c.id === slug);
  if (!customer) notFound();

  const myEngagements = engagements.filter((e) => e.customer_id === customer.id);
  const myDeployments = deployments.filter((d) => d.customer_id === customer.id);
  const tplById = new Map(templates.map((t) => [t.id, t]));
  const myExtractions = patternExtractions.filter(
    (p) => p.source_customer_id === customer.id
  );

  const totalHours = myDeployments.reduce(
    (s, d) => s + d.hours_replaced_per_week,
    0
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow={
          <Link href="/customers" className="hover:text-ink">
            ← Customers
          </Link>
        }
        title={customer.name}
        description={
          <>
            Backed by {customer.backed_by.join(", ")} ·{" "}
            {customer.is_pe ? "PE firm" : "Startup"} · with us since{" "}
            <span className="num text-ink">{formatDate(customer.start_date)}</span>
          </>
        }
        actions={
          <div className="flex items-center gap-4">
            <CustomerStatusMenu
              customerSlug={customer.id}
              current={customer.status}
            />
            <CustomerHealthMenu
              customerSlug={customer.id}
              current={customer.health}
            />
          </div>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6 border-y border-line py-6 mb-14">
        <Field
          label="MRR"
          value={
            <div className="text-ink t-h3">
              <MrrInput
                customerSlug={customer.id}
                current={customer.current_mrr}
              />
            </div>
          }
        />
        <Field
          label="ARR run-rate"
          value={
            <span className="num text-ink t-h3">
              {formatUsd(customer.current_mrr * 12)}
            </span>
          }
        />
        <Field
          label="Live agents"
          value={<span className="num text-ink t-h3">{myDeployments.length}</span>}
        />
        <Field
          label="Hours replaced / wk"
          value={
            <span className="num text-ink t-h3">{formatHours(totalHours)}</span>
          }
        />
      </section>

      <section className="mb-16">
        <SectionHeader eyebrow="— Engagements" title="Past and present." />
        {myEngagements.length === 0 ? (
          <p className="text-ink-3 text-sm">No engagements logged.</p>
        ) : (
          <ul className="border-t border-line">
            {myEngagements.map((e) => (
              <li
                key={e.id}
                className="border-b border-line py-5 grid md:grid-cols-[1fr_auto] gap-4 items-center"
              >
                <div>
                  <Link
                    href={`/engagements/${e.id}`}
                    className="t-h3 hover:underline"
                  >
                    {e.notes.split(".")[0]}.
                  </Link>
                  <div className="mt-1 t-caption flex items-center gap-2 text-ink-3">
                    <PhaseBadge phase={e.phase} /> ·{" "}
                    <span className="num">{formatDate(e.start_date)}</span> →{" "}
                    <span className="num">{formatDate(e.expected_end_date)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="num text-ink-2 text-[12.5px]">
                    {formatHours(e.weekly_hours)} / wk
                  </span>
                  <HealthPip value={e.health} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-16">
        <SectionHeader
          eyebrow="— Agents deployed"
          title={`${myDeployments.length} shipped.`}
        />
        {myDeployments.length === 0 ? (
          <p className="text-ink-3 text-sm">Nothing deployed yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-line border border-line rounded-sm overflow-hidden">
            {myDeployments.map((d) => {
              const tpl = d.template_id ? tplById.get(d.template_id) : null;
              return (
                <div key={d.id} className="bg-page p-5">
                  <div className="t-h3">{d.agent_name}</div>
                  <div className="mt-1 t-caption text-ink-3">
                    {tpl ? (
                      <>
                        Based on{" "}
                        <Link
                          href={`/templates/${tpl.id}`}
                          className="text-ink-2 hover:underline"
                        >
                          {tpl.name}
                        </Link>{" "}
                        · <span className="num">{d.customization_pct}%</span>{" "}
                        custom
                      </>
                    ) : (
                      <>Fully custom</>
                    )}
                  </div>
                  <div className="mt-4 t-caption flex items-center justify-between">
                    <span>
                      Deployed{" "}
                      <span className="num text-ink">{formatDate(d.deployed_at)}</span>
                    </span>
                    <span>
                      <span className="num text-ink">
                        {formatHours(d.hours_replaced_per_week)}
                      </span>{" "}
                      / wk replaced
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {myExtractions.length > 0 && (
        <section>
          <SectionHeader
            eyebrow="— Templates extracted"
            title="What we kept from working with this customer."
          />
          <ul className="border-t border-line">
            {myExtractions.map((p) => {
              const tpl = tplById.get(p.extracted_into_template_id);
              return (
                <li key={p.id} className="border-b border-line py-5">
                  <Link
                    href={`/templates/${tpl?.id ?? ""}`}
                    className="t-h3 hover:underline"
                  >
                    {tpl?.name ?? "—"}
                  </Link>
                  <p className="mt-1 text-ink-2 text-[13.5px]">
                    {p.source_engagement_summary}
                  </p>
                  <div className="mt-2 t-caption text-ink-3">
                    Now used at{" "}
                    <span className="num text-ink">
                      {p.reused_at_customer_ids.length}
                    </span>{" "}
                    other customer
                    {p.reused_at_customer_ids.length === 1 ? "" : "s"}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </PageShell>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="t-caption mb-2">{label}</div>
      <div className="text-ink">{value}</div>
    </div>
  );
}
