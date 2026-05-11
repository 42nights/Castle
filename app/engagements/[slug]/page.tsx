import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AvatarGroup,
  HealthPip,
  PhaseBadge,
  ProgressBar,
  StatusChip,
} from "@/components/atoms";
import { PageHeader, PageShell, SectionHeader } from "@/components/page-shell";
import { HealthMenu } from "@/components/controls/health-menu";
import { NotesEditor } from "@/components/controls/notes-editor";
import { PhaseMenu } from "@/components/controls/phase-menu";
import { ProgressSlider } from "@/components/controls/progress-slider";
import { TouchedButton } from "@/components/controls/touched-button";
import { loadAll } from "@/lib/data";
import { formatDate, formatHours, formatPct, formatUsd } from "@/lib/format";

export default async function EngagementDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { engagements, customers, fdes, deployments, templates, patternExtractions } = loadAll();
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
      <PageHeader
        eyebrow={
          <>
            <Link
              href="/engagements"
              className="hover:text-ink"
            >
              ← Engagements
            </Link>
          </>
        }
        title={customer.name}
        description={
          <span>
            <Link
              href={`/customers/${customer.id}`}
              className="hover:underline"
            >
              {customer.is_pe ? "PE" : "VC-backed startup"}
            </Link>
            {" · "}backed by {customer.backed_by.join(", ")}
            {" · "}MRR <span className="num text-ink">{formatUsd(customer.current_mrr)}</span>
          </span>
        }
        actions={
          <div className="flex items-center gap-4">
            <HealthPip value={eng.health} label={`Health · ${eng.health}`} />
            <StatusChip status={customer.status} />
          </div>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-5 gap-x-8 gap-y-6 border-y border-line py-6 mb-14">
        <Field
          label="Phase"
          value={<PhaseMenu engagementSlug={eng.id} current={eng.phase} />}
        />
        <Field
          label="Progress"
          value={
            <ProgressSlider
              engagementSlug={eng.id}
              current={eng.progress_pct}
            />
          }
        />
        <Field
          label="Health"
          value={<HealthMenu engagementSlug={eng.id} current={eng.health} />}
        />
        <Field
          label="Team"
          value={<AvatarGroup names={team.map((f) => f!.name)} />}
        />
        <Field
          label="Activity"
          value={<TouchedButton engagementSlug={eng.id} />}
        />
      </section>

      <section className="grid md:grid-cols-[240px_1fr] gap-10 mb-16">
        <div>
          <div className="t-eyebrow mb-2">— This week</div>
          <h2 className="t-h2 text-ink">Notes.</h2>
          <p className="mt-3 text-ink-2 text-[13px] leading-relaxed">
            Autosaves on idle. Versioned — rejects stale writes from other
            tabs.
          </p>
          <div className="mt-5 t-caption text-ink-3">
            <span className="num">{formatHours(eng.weekly_hours)}</span> / wk
            committed
            <br />
            Started{" "}
            <span className="num">{formatDate(eng.start_date)}</span> · ends{" "}
            <span className="num">{formatDate(eng.expected_end_date)}</span>
          </div>
        </div>
        <NotesEditor
          engagementSlug={eng.id}
          initialBody={eng.notes}
          initialVersion={1}
        />
      </section>

      <section className="mb-16">
        <SectionHeader eyebrow="— Agents on this engagement" title="Deployments." />
        {deps.length === 0 ? (
          <div className="text-ink-3 text-sm">None deployed yet.</div>
        ) : (
          <div className="border-t border-b border-line">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line text-ink-3 uppercase tracking-[0.06em] text-[10px]">
                  <th className="text-left h-9 px-3 font-medium">Agent</th>
                  <th className="text-left h-9 px-3 font-medium">Template</th>
                  <th className="text-right h-9 px-3 font-medium">Custom %</th>
                  <th className="text-right h-9 px-3 font-medium">Hrs/wk replaced</th>
                  <th className="text-right h-9 px-3 font-medium">Deployed</th>
                </tr>
              </thead>
              <tbody>
                {deps.map((d) => {
                  const tpl = d.template_id ? tplById.get(d.template_id) : null;
                  return (
                    <tr key={d.id} className="border-b border-line last:border-b-0">
                      <td className="px-3 py-3 text-ink">{d.agent_name}</td>
                      <td className="px-3 py-3 text-ink-2">
                        {tpl ? (
                          <Link
                            href={`/templates/${tpl.id}`}
                            className="hover:underline"
                          >
                            {tpl.name}
                          </Link>
                        ) : (
                          <span className="t-caption text-ink-3">— fully custom</span>
                        )}
                      </td>
                      <td className="px-3 py-3 num text-right text-ink-2">
                        {formatPct(d.customization_pct / 100)}
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
        <section className="mb-16">
          <SectionHeader
            eyebrow="— Patterns extracted from this engagement"
            title="What we kept."
          />
          <ul className="border-t border-line">
            {relatedExtractions.map((p) => {
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
                    Reused at{" "}
                    <span className="num text-ink">
                      {p.reused_at_customer_ids.length}
                    </span>{" "}
                    customer{p.reused_at_customer_ids.length === 1 ? "" : "s"}
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
