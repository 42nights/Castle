import Link from "next/link";
import { notFound } from "next/navigation";
import { HealthPip, PhaseBadge } from "@/components/atoms";
import { BackedByInput } from "@/components/controls/backed-by-input";
import { CustomerHealthMenu } from "@/components/controls/customer-health-menu";
import { CustomerStatusMenu } from "@/components/controls/customer-status-menu";
import {
  DeploymentCustomPctInput,
  DeploymentHoursInput,
} from "@/components/controls/deployment-inline";
import { InlineName } from "@/components/controls/inline-name";
import { MrrInput } from "@/components/controls/mrr-input";
import { WeeklyHoursInput } from "@/components/controls/weekly-hours-input";
import { PageHeader, PageShell } from "@/components/page-shell";
import { loadOverview } from "@/lib/load-overview";
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
  } = await loadOverview();
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
        kicker={
          <Link href="/customers" className="hover:text-ink">
            ← Customers
          </Link>
        }
        title={
          <InlineName
            kind="customer"
            slug={customer.id}
            current={customer.name}
            className="t-h1 text-ink"
          />
        }
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <BackedByInput
              customerSlug={customer.id}
              current={customer.backed_by}
              mode="block"
            />
            <span className="text-ink-3">·</span>
            <span>{customer.is_pe ? "PE" : "Startup"}</span>
            <span className="text-ink-3">·</span>
            <span>
              since{" "}
              <span className="num">{formatDate(customer.start_date)}</span>
            </span>
          </span>
        }
        actions={
          <div className="flex items-center gap-3 text-[12px]">
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

      <Panel title="Stats">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-line">
          <Stat label="MRR">
            <MrrInput
              customerSlug={customer.id}
              current={customer.current_mrr}
            />
          </Stat>
          <Stat label="ARR run-rate">
            <span className="num">{formatUsd(customer.current_mrr * 12)}</span>
          </Stat>
          <Stat label="Live agents">
            <span className="num">{myDeployments.length}</span>
          </Stat>
          <Stat label="Hrs / wk replaced">
            <span className="num">{formatHours(totalHours)}</span>
          </Stat>
        </div>
      </Panel>

      <Panel title="Engagements" count={myEngagements.length}>
        {myEngagements.length === 0 ? (
          <p className="px-3 py-2 text-ink-3 text-[12px]">
            No engagements logged.
          </p>
        ) : (
          <ul className="ledger">
            {myEngagements.map((e) => (
              <li
                key={e.id}
                className="px-3 py-2 grid grid-cols-[14px_1fr_auto_auto] items-baseline gap-3"
              >
                <HealthPip value={e.health} />
                <Link
                  href={`/engagements/${e.id}`}
                  className="min-w-0 truncate text-ink text-[13.5px] hover:underline underline-offset-2 decoration-line"
                >
                  {e.notes.split(".")[0]}
                </Link>
                <span className="t-caption inline-flex items-center gap-1.5">
                  <PhaseBadge phase={e.phase} />
                  <span className="num">{formatDate(e.start_date)}</span>
                  <span className="text-ink-3">→</span>
                  <span className="num">
                    {formatDate(e.expected_end_date)}
                  </span>
                </span>
                <span className="text-[12px] text-ink-2 inline-flex items-baseline gap-0.5">
                  <WeeklyHoursInput
                    engagementSlug={e.id}
                    current={e.weekly_hours}
                  />
                  <span>/wk</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Deployments" count={myDeployments.length}>
        {myDeployments.length === 0 ? (
          <p className="px-3 py-2 text-ink-3 text-[12px]">
            Nothing deployed yet.
          </p>
        ) : (
          <ul className="ledger">
            {myDeployments.map((d) => {
              const tpl = d.template_id ? tplById.get(d.template_id) : null;
              return (
                <li
                  key={d.id}
                  className="px-3 py-2 grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-4"
                >
                  <span className="min-w-0 truncate text-ink text-[13.5px]">
                    {d.agent_name}
                    <span className="ml-2 t-caption">
                      {tpl ? (
                        <>
                          from{" "}
                          <Link
                            href={`/templates/${tpl.id}`}
                            className="text-ink-2 hover:text-ink underline underline-offset-2 decoration-line"
                          >
                            {tpl.name}
                          </Link>
                        </>
                      ) : (
                        <>custom</>
                      )}
                    </span>
                  </span>
                  <span className="text-[12px] text-ink-2 inline-flex items-baseline">
                    <DeploymentCustomPctInput
                      deploymentId={d.id}
                      current={d.customization_pct}
                    />
                    <span className="ml-0.5">custom</span>
                  </span>
                  <span className="num text-[12px] text-ink-3">
                    {formatDate(d.deployed_at)}
                  </span>
                  <span className="text-[12px] text-ink-2 inline-flex items-baseline">
                    <DeploymentHoursInput
                      deploymentId={d.id}
                      current={d.hours_replaced_per_week}
                    />
                    <span className="ml-0.5">/wk</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {myExtractions.length > 0 && (
        <Panel title="Patterns extracted" count={myExtractions.length}>
          <ul className="ledger">
            {myExtractions.map((p) => {
              const tpl = tplById.get(p.extracted_into_template_id);
              return (
                <li
                  key={p.id}
                  className="px-3 py-2 grid grid-cols-[1fr_auto] items-baseline gap-4"
                >
                  <span className="min-w-0">
                    <Link
                      href={`/templates/${tpl?.id ?? ""}`}
                      className="text-ink text-[13.5px] hover:underline underline-offset-2 decoration-line"
                    >
                      {tpl?.name ?? "—"}
                    </Link>
                    <span className="ml-2 text-ink-2 text-[12.5px]">
                      {p.source_engagement_summary}
                    </span>
                  </span>
                  <span className="t-caption">
                    reused at{" "}
                    <span className="num text-ink-2">
                      {p.reused_at_customer_ids.length}
                    </span>{" "}
                    other
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </PageShell>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-3 py-3">
      <div className="text-[10px] tracking-[0.06em] text-ink-3 uppercase mb-1">
        {label}
      </div>
      <div className="text-ink text-[18px] leading-[24px] font-medium num">
        {children}
      </div>
    </div>
  );
}

function Panel({
  title,
  count,
  right,
  children,
}: {
  title: string;
  count?: number;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg bg-surface border border-line overflow-hidden mb-4">
      <header className="flex items-baseline justify-between gap-4 px-4 py-3 border-b border-line">
        <div className="flex items-baseline gap-2">
          <h2 className="t-h2">{title}</h2>
          {typeof count === "number" && (
            <span className="num text-[12px] text-ink-3">{count}</span>
          )}
        </div>
        {right}
      </header>
      <div>{children}</div>
    </section>
  );
}
