import Link from "next/link";
import { notFound } from "next/navigation";
import { BackedByInput } from "@/components/controls/backed-by-input";
import { CustomerHealthMenu } from "@/components/controls/customer-health-menu";
import { CustomerStatusMenu } from "@/components/controls/customer-status-menu";
import {
  DeploymentCustomPctInput,
  DeploymentHoursInput,
} from "@/components/controls/deployment-inline";
import { InlineName } from "@/components/controls/inline-name";
import { CustomerHeroStats } from "@/components/customers/hero-stats";
import { EngagementCards } from "@/components/customers/engagement-cards";
import { PageHeader, PageShell } from "@/components/page-shell";
import { loadOverview } from "@/lib/load-overview";
import { formatDate } from "@/lib/format";

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

  return (
    <PageShell>
      <PageHeader
        variant="operator"
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
          <div className="flex items-center gap-2">
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

      {/* Hero metric strip — MRR inline-editable with dotted-underline affordance */}
      <CustomerHeroStats customer={customer} deployments={myDeployments} />

      {/* Engagements — hero card grid */}
      <Panel title="Engagements" count={myEngagements.length}>
        <EngagementCards engagements={myEngagements} />
      </Panel>

      {/* Deployments — supporting ledger */}
      <Panel title="Deployments" count={myDeployments.length}>
        {myDeployments.length === 0 ? (
          <p className="text-ink-3 text-[13px]">Nothing deployed yet.</p>
        ) : (
          <div className="border border-line rounded-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line text-ink-3 uppercase tracking-[0.06em] text-[10px]">
                  <th className="text-left h-9 px-4 font-medium">Agent</th>
                  <th className="text-right h-9 px-3 font-medium hidden md:table-cell">Custom %</th>
                  <th className="text-right h-9 px-3 font-medium hidden sm:table-cell">Deployed</th>
                  <th className="text-right h-9 px-3 font-medium">Hrs/wk</th>
                </tr>
              </thead>
              <tbody>
                {myDeployments.map((d) => {
                  const tpl = d.template_id ? tplById.get(d.template_id) : null;
                  return (
                    <tr
                      key={d.id}
                      className="border-b border-line last:border-b-0 hover:bg-surface-1 transition-colors duration-instant"
                    >
                      <td className="px-4 py-3.5 text-ink text-[13.5px]">
                        {d.agent_name}
                        <span className="ml-2 text-[12px] text-ink-3">
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
                            "custom"
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 hidden md:table-cell">
                        <span className="text-[12px] text-ink-2 inline-flex items-baseline">
                          <DeploymentCustomPctInput
                            deploymentId={d.id}
                            current={d.customization_pct}
                          />
                          <span className="ml-0.5">custom</span>
                        </span>
                      </td>
                      <td className="px-3 py-3.5 num text-right text-ink-3 text-[12px] hidden sm:table-cell">
                        {formatDate(d.deployed_at)}
                      </td>
                      <td className="px-3 py-3.5 text-[12px] text-ink-2 inline-flex items-baseline text-right">
                        <DeploymentHoursInput
                          deploymentId={d.id}
                          current={d.hours_replaced_per_week}
                        />
                        <span className="ml-0.5">/wk</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Patterns extracted */}
      {myExtractions.length > 0 && (
        <Panel title="Patterns extracted" count={myExtractions.length}>
          <ul className="space-y-3">
            {myExtractions.map((p) => {
              const tpl = tplById.get(p.extracted_into_template_id);
              return (
                <li key={p.id} className="flex items-baseline justify-between gap-4">
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
                  <span className="t-caption shrink-0">
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

      {/* Danger zone */}
      <DangerZone customerName={customer.name} customerId={customer.id} />
    </PageShell>
  );
}

function Panel({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md bg-canvas border border-line shadow-[var(--shadow-base)] overflow-hidden mb-4">
      <header className="flex items-baseline gap-2 px-5 py-3.5 border-b border-line">
        <h2 className="t-h2">{title}</h2>
        {typeof count === "number" && (
          <span className="num text-[12px] text-ink-3">{count}</span>
        )}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function DangerZone({
  customerName,
  customerId,
}: {
  customerName: string;
  customerId: string;
}) {
  return (
    <section className="rounded-md border border-health-bad/30 bg-health-soft-bad/20 overflow-hidden mt-8 mb-4">
      <header className="px-5 py-3.5 border-b border-health-bad/20">
        <h2 className="t-h2 text-health-bad">Danger zone</h2>
      </header>
      <div className="px-5 py-4">
        <p className="text-[13px] text-ink-2 mb-3">
          Deleting <strong>{customerName}</strong> removes all associated engagements and deployments.
          This cannot be undone.
        </p>
        <p className="t-caption text-ink-3">
          Use customer-id:{" "}
          <span className="num text-ink-2">{customerId}</span>
        </p>
      </div>
    </section>
  );
}

import * as React from "react";
