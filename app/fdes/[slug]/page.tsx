import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Avatar,
  CategoryBadge,
  HealthPip,
  PhaseBadge,
} from "@/components/atoms";
import { DeleteFdeZone } from "@/components/controls/danger-zone";
import { FdeTagsInput } from "@/components/controls/fde-tags-input";
import { InlineName } from "@/components/controls/inline-name";
import { FdeActivity } from "@/components/sections/fde-activity";
import { PageHeader, PageShell, SectionHeader } from "@/components/page-shell";
import { CapacityStrip } from "@/components/fdes/capacity-strip";
import { loadOverview } from "@/lib/load-overview";
import { isEngagementOpen } from "@/lib/derive";
import { formatDate, formatHours } from "@/lib/format";

export default async function FdeDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { fdes, engagements, customers, deployments, templates } =
    await loadOverview();
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
      {/* Header: Avatar 96px right-aligned, name 32px Inter, role beneath */}
      <PageHeader
        variant="operator"
        kicker={
          <Link href="/fdes" className="hover:text-ink">
            ← FDEs
          </Link>
        }
        title={
          <InlineName
            kind="fde"
            slug={fde.id}
            current={fde.name}
            className="t-h1 text-ink"
          />
        }
        description={
          <>
            {fde.role}
            {fde.is_founder && " · co-founder"} · with 42nights since{" "}
            <span className="num text-ink">{formatDate(fde.start_date)}</span>
          </>
        }
        actions={<Avatar name={fde.name} size={96} />}
      />

      {/* Tags */}
      <section className="border-y border-line py-4 mb-6 flex items-start gap-4">
        <span className="t-caption text-ink-3 pt-1.5 shrink-0">Tags</span>
        <FdeTagsInput fdeSlug={fde.id} current={fde.tags} mode="block" />
      </section>

      {/* Capacity strip — hero visual for this page */}
      <CapacityStrip fde={fde} activeEngagements={active} />

      {/* Active engagements — cards */}
      <section className="mb-10">
        <SectionHeader title="Active engagements." />
        {active.length === 0 ? (
          <p className="text-ink-3 text-sm">Bench — no active engagements.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {active.map((e) => {
              const c = cById.get(e.customer_id);
              return (
                <Link
                  key={e.id}
                  href={`/engagements/${e.id}`}
                  className="group block rounded-md bg-canvas border border-line shadow-[var(--shadow-base)] p-5 hover:shadow-[var(--shadow-md)] hover:-translate-y-px transition-[box-shadow,transform] duration-[var(--duration-base)] focus-visible:shadow-[var(--shadow-focus)] outline-none"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="text-[15px] font-medium text-ink leading-snug">
                      {c?.name ?? "—"}
                    </div>
                    <HealthPip value={e.health} />
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <PhaseBadge phase={e.phase} />
                    <span className="num text-[12px] text-ink-3">
                      {e.progress_pct}%
                    </span>
                    <span className="text-ink-3">·</span>
                    <span className="num text-[12px] text-ink-3">
                      {formatHours(e.weekly_hours)}/wk
                    </span>
                  </div>
                  <p className="text-[13px] text-ink-2 line-clamp-2 leading-relaxed">
                    {e.notes}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Past engagements — collapsed details */}
      {past.length > 0 && (
        <section className="mb-10">
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer list-none select-none mb-3">
              <SectionHeader title={`Past engagements · ${past.length}`} />
              <svg
                className="w-4 h-4 text-ink-3 transition-transform duration-quick group-open:rotate-180 shrink-0 mb-0.5"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <ul className="border-t border-line">
              {past.map((e) => {
                const c = cById.get(e.customer_id);
                return (
                  <li
                    key={e.id}
                    className="border-b border-line py-3.5 flex items-center gap-4"
                  >
                    <Link
                      href={`/engagements/${e.id}`}
                      className="text-ink hover:underline flex-1 text-[14px]"
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
          </details>
        </section>
      )}

      {/* Deployments built on engagements */}
      {myDeployments.length > 0 && (
        <section className="mb-10">
          <SectionHeader title="Built on engagements." />
          <div className="rounded-md border border-line overflow-hidden bg-canvas shadow-[var(--shadow-base)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line text-ink-3 uppercase tracking-[0.06em] text-[10px]">
                  <th className="text-left h-9 px-4 font-medium">Agent</th>
                  <th className="text-left h-9 px-3 font-medium hidden md:table-cell">Customer</th>
                  <th className="text-right h-9 px-3 font-medium hidden md:table-cell">Hrs replaced / wk</th>
                  <th className="text-right h-9 px-3 font-medium">Deployed</th>
                </tr>
              </thead>
              <tbody>
                {myDeployments.map((d) => {
                  const c = cById.get(d.customer_id);
                  return (
                    <tr
                      key={d.id}
                      className="border-b border-line last:border-b-0 hover:bg-surface-1 transition-colors duration-instant"
                    >
                      <td className="px-4 py-3.5 text-ink text-[13.5px]">
                        {d.agent_name}
                      </td>
                      <td className="px-3 py-3.5 hidden md:table-cell">
                        <Link
                          href={`/customers/${c?.id ?? ""}`}
                          className="text-ink-2 hover:underline text-[13.5px]"
                        >
                          {c?.name ?? "—"}
                        </Link>
                      </td>
                      <td className="px-3 py-3.5 num text-right text-ink-2 text-[13px] hidden md:table-cell">
                        {formatHours(d.hours_replaced_per_week)}
                      </td>
                      <td className="px-3 py-3.5 num text-right text-ink-3 text-[12px]">
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

      {/* Templates extracted by this FDE */}
      {myTemplates.length > 0 && (
        <section className="mb-10">
          <SectionHeader title="Patterns this FDE extracted." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myTemplates.map((t) => (
              <Link
                key={t.id}
                href={`/templates/${t.id}`}
                className="group block rounded-md bg-canvas border border-line shadow-[var(--shadow-base)] p-5 hover:shadow-[var(--shadow-md)] hover:-translate-y-px transition-[box-shadow,transform] duration-[var(--duration-base)] focus-visible:shadow-[var(--shadow-focus)] outline-none"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="text-[15px] font-medium text-ink">{t.name}</div>
                  <CategoryBadge category={t.category} />
                </div>
                <ul className="mt-2 space-y-1 text-[13px] text-ink-2">
                  {t.capabilities.slice(0, 2).map((c) => (
                    <li key={c}>· {c}</li>
                  ))}
                </ul>
                <div className="mt-3 t-caption text-ink-3">
                  Authored{" "}
                  <span className="num">{formatDate(t.created_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Activity timeline */}
      <section className="mb-10">
        <SectionHeader title="What this FDE has touched." />
        <FdeActivity fdeSlug={fde.id} />
      </section>

      {/* Danger zone */}
      <div className="rounded-md border border-health-bad/30 bg-health-soft-bad/20 overflow-hidden mb-4">
        <DeleteFdeZone
          fdeSlug={fde.id}
          fdeName={fde.name}
          activeEngagementCount={active.length}
        />
      </div>
    </PageShell>
  );
}
