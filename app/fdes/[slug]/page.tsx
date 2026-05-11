import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Avatar,
  CategoryBadge,
  HealthPip,
  PhaseBadge,
} from "@/components/atoms";
import { CapacityInput } from "@/components/controls/capacity-input";
import { LogHoursButton } from "@/components/controls/log-hours-button";
import { PageHeader, PageShell, SectionHeader } from "@/components/page-shell";
import { loadAll } from "@/lib/data";
import { isEngagementOpen } from "@/lib/derive";
import { formatDate, formatHours } from "@/lib/format";

export default async function FdeDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { fdes, engagements, customers, deployments, templates } = loadAll();
  const fde = fdes.find((f) => f.id === slug);
  if (!fde) notFound();

  const cById = new Map(customers.map((c) => [c.id, c]));
  const myEngagements = engagements.filter((e) => e.fde_ids.includes(fde.id));
  const active = myEngagements.filter((e) =>
    isEngagementOpen(e, cById.get(e.customer_id))
  );
  const past = myEngagements.filter(
    (e) => !isEngagementOpen(e, cById.get(e.customer_id))
  );

  const myDeployments = deployments.filter((d) =>
    myEngagements.some((e) => e.id === d.engagement_id)
  );
  const myTemplates = templates.filter((t) => t.authored_by_fde_id === fde.id);

  return (
    <PageShell>
      <PageHeader
        eyebrow={
          <Link href="/fdes" className="hover:text-ink">
            ← FDEs
          </Link>
        }
        title={fde.name}
        description={
          <>
            {fde.role}
            {fde.is_founder && " · co-founder"} · with 42nights since{" "}
            <span className="num text-ink">{formatDate(fde.start_date)}</span>
          </>
        }
        actions={<Avatar name={fde.name} size={56} />}
      />

      <section className="grid grid-cols-2 md:grid-cols-5 gap-x-8 gap-y-6 border-y border-line py-6 mb-14">
        <Field
          label="Hours this week"
          value={
            <span className="num text-ink t-h3 inline-flex items-center gap-2">
              {formatHours(fde.hours_this_week)}
              <LogHoursButton fdeSlug={fde.id} />
            </span>
          }
        />
        <Field
          label="Capacity / wk"
          value={
            <span className="text-ink t-h3 num">
              <CapacityInput
                fdeSlug={fde.id}
                current={fde.capacity_hours_per_week}
              />
            </span>
          }
        />
        <Field
          label="Active eng"
          value={<span className="num text-ink t-h3">{active.length}</span>}
        />
        <Field
          label="Agents shipped"
          value={<span className="num text-ink t-h3">{fde.agents_shipped_total}</span>}
        />
        <Field
          label="Templates authored"
          value={<span className="num text-ink t-h3">{fde.templates_authored}</span>}
        />
      </section>

      <section className="mb-16">
        <SectionHeader eyebrow="— Current load" title="Active engagements." />
        {active.length === 0 ? (
          <p className="text-ink-3 text-sm">Bench, no active engagements.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-line border border-line rounded-sm overflow-hidden">
            {active.map((e) => {
              const c = cById.get(e.customer_id);
              return (
                <Link
                  key={e.id}
                  href={`/engagements/${e.id}`}
                  className="bg-page p-5 hover:bg-surface transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="t-h3">{c?.name ?? "—"}</div>
                    <HealthPip value={e.health} />
                  </div>
                  <div className="mt-2 t-caption flex items-center gap-2 text-ink-3">
                    <PhaseBadge phase={e.phase} />
                    <span className="num">{e.progress_pct}%</span>
                    <span>·</span>
                    <span className="num">{formatHours(e.weekly_hours)}/wk</span>
                  </div>
                  <p className="mt-3 text-[13px] text-ink-2 line-clamp-2">{e.notes}</p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="mb-16">
          <SectionHeader eyebrow="— History" title="Past engagements." />
          <ul className="border-t border-line">
            {past.map((e) => {
              const c = cById.get(e.customer_id);
              return (
                <li key={e.id} className="border-b border-line py-4 flex items-center gap-4">
                  <Link
                    href={`/engagements/${e.id}`}
                    className="text-ink hover:underline flex-1"
                  >
                    {c?.name ?? "—"}
                  </Link>
                  <PhaseBadge phase={e.phase} />
                  <span className="num t-caption text-ink-3 w-24 text-right">
                    {formatDate(e.expected_end_date)}
                  </span>
                  <HealthPip value={e.health} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {myDeployments.length > 0 && (
        <section className="mb-16">
          <SectionHeader eyebrow="— Agents shipped" title="Built on engagements." />
          <div className="border-t border-b border-line">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line text-ink-3 uppercase tracking-[0.06em] text-[10px]">
                  <th className="text-left h-9 px-3 font-medium">Agent</th>
                  <th className="text-left h-9 px-3 font-medium">Customer</th>
                  <th className="text-right h-9 px-3 font-medium">Hrs replaced / wk</th>
                  <th className="text-right h-9 px-3 font-medium">Deployed</th>
                </tr>
              </thead>
              <tbody>
                {myDeployments.map((d) => {
                  const c = cById.get(d.customer_id);
                  return (
                    <tr key={d.id} className="border-b border-line last:border-b-0">
                      <td className="px-3 py-3 text-ink">{d.agent_name}</td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/customers/${c?.id ?? ""}`}
                          className="text-ink-2 hover:underline"
                        >
                          {c?.name ?? "—"}
                        </Link>
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
        </section>
      )}

      {myTemplates.length > 0 && (
        <section>
          <SectionHeader eyebrow="— Templates" title="Patterns this FDE extracted." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-line border border-line rounded-sm overflow-hidden">
            {myTemplates.map((t) => (
              <Link
                key={t.id}
                href={`/templates/${t.id}`}
                className="bg-page p-5 hover:bg-surface transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="t-h3">{t.name}</div>
                  <CategoryBadge category={t.category} />
                </div>
                <ul className="mt-3 space-y-1 text-[13px] text-ink-2">
                  {t.capabilities.slice(0, 2).map((c) => (
                    <li key={c}>· {c}</li>
                  ))}
                </ul>
                <div className="mt-3 t-caption text-ink-3">
                  Authored <span className="num">{formatDate(t.created_at)}</span>
                </div>
              </Link>
            ))}
          </div>
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
