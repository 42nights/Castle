import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AvatarGroup,
  HealthPip,
  StatusChip,
} from "@/components/atoms";
import { PageHeader, PageShell } from "@/components/page-shell";
import { DeleteEngagementZone } from "@/components/controls/danger-zone";
import { EditDeploymentButton } from "@/components/controls/deployment-row-button";
import { EndDateInput } from "@/components/controls/end-date-input";
import { EngagementKeys } from "@/components/controls/engagement-keys";
import { HealthMenu } from "@/components/controls/health-menu";
import { NotesEditor } from "@/components/controls/notes-editor";
import { PhaseMenu } from "@/components/controls/phase-menu";
import { ProgressSlider } from "@/components/controls/progress-slider";
import { TouchedButton } from "@/components/controls/touched-button";
import { WeeklyHoursInput } from "@/components/controls/weekly-hours-input";
import {
  NewDeploymentButton,
  ReassignButton,
} from "@/components/ctas";
import { ExtractPatternButton } from "@/components/sections/extraction-cta";
import { EngagementTimeline } from "@/components/sections/engagement-timeline";
import { NotesJournal } from "@/components/sections/notes-journal";
import { loadOverview } from "@/lib/load-overview";
import { formatDate, formatHours, formatPct, formatUsd } from "@/lib/format";

export default async function EngagementDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { engagements, customers, fdes, deployments, templates, patternExtractions } = await loadOverview();
  const eng = engagements.find((e) => e.id === slug);
  if (!eng) notFound();
  const customer = customers.find((c) => c.id === eng.customer_id)!;
  const team = eng.fde_ids
    .map((fid) => fdes.find((f) => f.id === fid))
    .filter(Boolean);
  const deps = deployments.filter((d) => d.engagement_id === eng.id);
  const tplById = new Map(templates.map((t) => [t.id, t]));
  const relatedExtractions = patternExtractions.filter(
    (p) => p.source_engagement_id === eng.id
  );

  return (
    <PageShell>
      <EngagementKeys engagementSlug={eng.id} />
      <PageHeader
        kicker={
          <Link href="/engagements" className="hover:text-ink">
            ← Engagements
          </Link>
        }
        title={customer.name}
        description={
          <>
            <Link
              href={`/customers/${customer.id}`}
              className="hover:underline underline-offset-2 decoration-line"
            >
              {customer.is_pe ? "PE" : "VC-backed startup"}
            </Link>
            {" · "}backed by {customer.backed_by.join(", ")}
            {" · MRR "}
            <span className="num text-ink">
              {formatUsd(customer.current_mrr)}
            </span>
          </>
        }
        actions={
          <div className="flex items-center gap-3 text-[12px]">
            <HealthPip value={eng.health} label={`Health · ${eng.health}`} />
            <StatusChip status={customer.status} />
          </div>
        }
      />

      <Panel title="Status">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-3 px-3 py-3">
          <Field label="Phase">
            <PhaseMenu engagementSlug={eng.id} current={eng.phase} />
          </Field>
          <Field label="Progress">
            <ProgressSlider
              engagementSlug={eng.id}
              current={eng.progress_pct}
            />
          </Field>
          <Field label="Health">
            <HealthMenu engagementSlug={eng.id} current={eng.health} />
          </Field>
          <Field label="Team">
            <AvatarGroup names={team.map((f) => f!.name)} />
          </Field>
          <Field label="Activity">
            <TouchedButton engagementSlug={eng.id} />
          </Field>
        </div>
      </Panel>

      <Panel title="Notes">
        <div className="grid md:grid-cols-[200px_1fr] gap-0 divide-x divide-line">
          <div className="px-3 py-3 text-[12px] text-ink-3 leading-snug">
            <div className="text-ink-2">
              Autosaves on idle · versioned.
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <WeeklyHoursInput
                engagementSlug={eng.id}
                current={eng.weekly_hours}
              />
              <span>/ wk committed</span>
            </div>
            <div className="mt-1">
              Started{" "}
              <span className="num text-ink-2">
                {formatDate(eng.start_date)}
              </span>
              {" · ends "}
              <EndDateInput
                engagementSlug={eng.id}
                current={eng.expected_end_date}
              />
            </div>
            <div className="mt-3">
              Press{" "}
              <kbd className="rounded-sm border border-line bg-surface px-1 num text-[10px]">
                u
              </kbd>{" "}
              to mark touched.
            </div>
          </div>
          <div className="px-3 py-3">
            <NotesEditor
              engagementSlug={eng.id}
              initialBody={eng.notes}
              initialVersion={1}
            />
          </div>
        </div>
      </Panel>

      <Panel
        title="Deployments"
        count={deps.length}
        right={
          <div className="flex items-center gap-2">
            <ReassignButton engagementSlug={eng.id} />
            <NewDeploymentButton
              engagementId={eng.id}
              customerId={customer.id}
            />
          </div>
        }
      >
        {deps.length === 0 ? (
          <div className="px-3 py-3 text-ink-3 text-[12px]">
            None deployed yet.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-line text-ink-3 uppercase tracking-[0.06em] text-[10px]">
                <th className="text-left h-8 px-3 font-medium">Agent</th>
                <th className="text-left h-8 px-3 font-medium">Template</th>
                <th className="text-right h-8 px-3 font-medium">Custom %</th>
                <th className="text-right h-8 px-3 font-medium">Hrs/wk</th>
                <th className="text-right h-8 px-3 font-medium">Deployed</th>
                <th className="h-8 px-3" />
              </tr>
            </thead>
            <tbody>
              {deps.map((d) => {
                const tpl = d.template_id ? tplById.get(d.template_id) : null;
                return (
                  <tr
                    key={d.id}
                    className="border-b border-line last:border-b-0"
                  >
                    <td className="px-3 py-2 text-ink text-[13.5px]">
                      {d.agent_name}
                    </td>
                    <td className="px-3 py-2 text-ink-2 text-[13px]">
                      {tpl ? (
                        <Link
                          href={`/templates/${tpl.id}`}
                          className="hover:underline underline-offset-2 decoration-line"
                        >
                          {tpl.name}
                        </Link>
                      ) : (
                        <span className="text-ink-3">— custom</span>
                      )}
                    </td>
                    <td className="px-3 py-2 num text-right text-ink-2 text-[12.5px]">
                      {formatPct(d.customization_pct / 100)}
                    </td>
                    <td className="px-3 py-2 num text-right text-ink-2 text-[12.5px]">
                      {formatHours(d.hours_replaced_per_week)}
                    </td>
                    <td className="px-3 py-2 num text-right text-ink-3 text-[12px]">
                      {formatDate(d.deployed_at)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <EditDeploymentButton
                        deploymentId={d.id}
                        initial={{
                          agent_name: d.agent_name,
                          template_id: d.template_id,
                          hours_replaced_per_week: d.hours_replaced_per_week,
                          customization_pct: d.customization_pct,
                          deployed_at: d.deployed_at,
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel
        title="Patterns extracted"
        count={relatedExtractions.length}
        right={<ExtractPatternButton sourceEngagementSlug={eng.id} />}
      >
        {relatedExtractions.length === 0 ? (
          <p className="px-3 py-3 text-ink-3 text-[12px]">
            Nothing extracted yet. Capture a pattern with{" "}
            <span className="t-mono">+ Extract pattern</span>.
          </p>
        ) : (
          <ul className="ledger">
            {relatedExtractions.map((p) => {
              const tpl = tplById.get(p.extracted_into_template_id);
              return (
                <li key={p.id} className="px-3 py-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link
                      href={`/templates/${tpl?.id ?? ""}`}
                      className="text-ink text-[13.5px] hover:underline underline-offset-2 decoration-line"
                    >
                      {tpl?.name ?? "—"}
                    </Link>
                    <span className="t-caption">
                      reused at{" "}
                      <span className="num text-ink-2">
                        {p.reused_at_customer_ids.length}
                      </span>{" "}
                      customer
                      {p.reused_at_customer_ids.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-ink-2 text-[12.5px] leading-snug">
                    {p.source_engagement_summary}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Versioned history">
        <div className="px-3 py-3">
          <NotesJournal engagementSlug={eng.id} />
        </div>
      </Panel>

      <Panel title="Touch log">
        <div className="px-3 py-3">
          <EngagementTimeline engagementSlug={eng.id} />
        </div>
      </Panel>

      <DeleteEngagementZone
        engagementSlug={eng.id}
        customerName={customer.name}
      />
    </PageShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] tracking-[0.06em] text-ink-3 uppercase mb-1">
        {label}
      </div>
      <div className="text-ink text-[13px]">{children}</div>
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
    <section className="panel mb-4">
      <header className="panel-header">
        <div className="flex items-baseline gap-2">
          <h2 className="t-h2 text-ink">{title}</h2>
          {typeof count === "number" && (
            <span className="t-caption">{count}</span>
          )}
        </div>
        {right}
      </header>
      <div className="panel-body no-pad">{children}</div>
    </section>
  );
}
