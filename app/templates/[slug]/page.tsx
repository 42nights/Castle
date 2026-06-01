import Link from "next/link";
import { notFound } from "next/navigation";
import { ExtractionRowDelete } from "@/components/controls/extraction-row-delete";
import { TemplateAuthorSelect } from "@/components/controls/template-author-select";
import { TemplateCategoryMenu } from "@/components/controls/template-category-menu";
import { TemplateOriginSelect } from "@/components/controls/template-origin-select";
import { CapabilityEditor } from "@/components/controls/capability-editor";
import { GithubRepoInput } from "@/components/controls/github-repo-input";
import { InlineName } from "@/components/controls/inline-name";
import { LiveUrlInput } from "@/components/controls/live-url-input";
import { TemplateTagsInput } from "@/components/controls/template-tags-input";
import { TemplateActionsMenu } from "./actions-menu";
import { PageHeader, PageShell } from "@/components/page-shell";
import { loadTemplateData, trySignedIn } from "@/lib/load-overview";
import { RoleProvider } from "@/lib/role-context";
import { formatDate, formatHours } from "@/lib/format";

export default async function TemplateDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { isOperator } = await trySignedIn();
  const { templates, customers, deployments, engagements, patternExtractions, fdes } =
    await loadTemplateData();
  const tpl = templates.find((t) => t.id === slug);
  if (!tpl) notFound();

  const cById = new Map(customers.map((c) => [c.id, c]));
  const authorFde = fdes.find((f) => f.id === tpl.authored_by_fde_id);
  const originCustomer = cById.get(tpl.origin_customer_id);
  const deps = deployments.filter((d) => d.template_id === tpl.id);
  const customerCount = new Set(deps.map((d) => d.customer_id)).size;
  const relatedExtractions = patternExtractions.filter(
    (p) => p.extracted_into_template_id === tpl.id
  );
  const totalHours = deps.reduce((s, d) => s + d.hours_replaced_per_week, 0);
  const avgCustom =
    deps.length === 0
      ? 0
      : Math.round(
          deps.reduce((s, d) => s + d.customization_pct, 0) / deps.length,
        );

  // Reuse arc: collect customers where this template was deployed (excluding origin)
  const deployedAtCustomers = Array.from(
    new Map(deps.map((d) => [d.customer_id, cById.get(d.customer_id)])).values()
  ).filter(Boolean).filter((c) => c!.id !== tpl.origin_customer_id).slice(0, 4);

  return (
    <RoleProvider role={isOperator ? "operator" : "guest"}>
      <PageShell>
        <PageHeader
          kicker={
            <Link href="/templates" className="hover:text-ink">
              ← Templates
            </Link>
          }
          eyebrow={tpl.category}
          title={
            <span className="inline-flex items-center gap-2">
              <InlineName
                kind="template"
                slug={tpl.id}
                current={tpl.name}
                className="t-h1 text-ink"
              />
              {tpl.archived_at && (
                <span className="t-caption rounded-sm border border-line px-1.5 py-0.5 text-ink-3 bg-surface-1">
                  Archived
                </span>
              )}
            </span>
          }
          description={
            <span className="inline-flex items-center gap-1.5 flex-wrap text-[12.5px] text-ink-2">
              Authored{" "}
              <span className="num text-ink">{formatDate(tpl.created_at)}</span>{" "}
              by
              <TemplateAuthorSelect
                templateSlug={tpl.id}
                currentFdeSlug={tpl.authored_by_fde_id}
                currentName={authorFde?.name}
              />
              from work with
              <TemplateOriginSelect
                templateSlug={tpl.id}
                currentCustomerSlug={tpl.origin_customer_id}
                currentName={originCustomer?.name}
              />
            </span>
          }
          actions={
            <div className="flex items-center gap-3">
              <LiveUrlInput templateSlug={tpl.id} current={tpl.live_url} />
              <GithubRepoInput
                templateSlug={tpl.id}
                current={tpl.github_repo}
              />
              <TemplateCategoryMenu
                templateSlug={tpl.id}
                current={tpl.category}
              />
              <TemplateActionsMenu slug={tpl.id} />
            </div>
          }
        />

        {/* Reuse arc — editorial centerpiece per §5.3/§7.2 */}
        {(originCustomer || deps.length > 0) && (
          <section
            aria-label="Reuse arc"
            className="mb-8 rounded-md bg-canvas shadow-[var(--shadow-base)] p-6"
          >
            <p className="t-eyebrow mb-4">Reuse arc</p>
            <div className="flex items-center gap-0 flex-wrap">
              {/* Origin node */}
              <ReuseArcNode
                label="Origin"
                name={originCustomer?.name ?? "—"}
                href={originCustomer ? `/customers/${originCustomer.id}` : undefined}
                variant="origin"
              />

              {/* Arrow */}
              <ArcArrow />

              {/* Template node */}
              <ReuseArcNode
                label="Template"
                name={tpl.name}
                variant="template"
              />

              {/* Reused-at nodes */}
              {deployedAtCustomers.map((c) => (
                <span key={c!.id} className="contents">
                  <ArcArrow />
                  <ReuseArcNode
                    label="Reused at"
                    name={c!.name}
                    href={`/customers/${c!.id}`}
                    subtext={
                      (() => {
                        const d = deps.find((dep) => dep.customer_id === c!.id);
                        return d ? `${d.customization_pct}% custom` : undefined;
                      })()
                    }
                    variant="reuse"
                  />
                </span>
              ))}

              {/* Overflow indicator */}
              {deps.length > deployedAtCustomers.length + (originCustomer ? 1 : 0) && (
                <span className="contents">
                  <ArcArrow />
                  <div className="flex items-center justify-center h-14 w-14 rounded-full bg-surface-1 border border-line text-ink-3 text-xs font-mono">
                    +{deps.length - deployedAtCustomers.length}
                  </div>
                </span>
              )}
            </div>
          </section>
        )}

        {/* Stats — typographically distinct, deployments as hero */}
        <section
          aria-label="Template stats"
          className="rounded-md bg-canvas shadow-[var(--shadow-base)] overflow-hidden mb-4"
        >
          <header className="flex items-baseline gap-2 px-5 py-3.5 border-b border-line">
            <h2 className="t-h2">Stats</h2>
          </header>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-line">
            {/* Deployments — hero stat in Fraunces amber */}
            <div className="px-5 py-5">
              <div className="t-eyebrow mb-2 text-accent-ink">Deployments</div>
              <div
                className="font-display text-[48px] leading-none tracking-[-0.02em] text-accent"
                style={{ fontVariationSettings: '"opsz" 144, "SOFT" 50, "WONK" 0' }}
                aria-label={`${deps.length} deployments`}
              >
                {deps.length}
              </div>
            </div>
            <StatCell label="Unique customers">
              <span className="num text-[28px] font-semibold text-ink">{customerCount}</span>
            </StatCell>
            <StatCell label="Hrs / wk replaced">
              <span className="num text-[28px] font-semibold text-ink">{formatHours(totalHours)}</span>
            </StatCell>
            <StatCell label="Avg customization">
              <span className="num text-[28px] font-semibold text-ink">
                {deps.length === 0 ? "—" : `${avgCustom}%`}
              </span>
            </StatCell>
          </div>
        </section>

        {/* Tags */}
        <section className="border-y border-line py-4 mb-4 flex items-start gap-4">
          <span className="t-caption text-ink-3 pt-1.5 shrink-0">Tags</span>
          <TemplateTagsInput
            templateSlug={tpl.id}
            current={tpl.tags}
            mode="block"
          />
        </section>

        {/* Capabilities */}
        <Panel title="Capabilities" count={tpl.capabilities.length}>
          <div className="px-3 py-3">
            <CapabilityEditor
              templateSlug={tpl.id}
              fallback={tpl.capabilities}
            />
          </div>
        </Panel>

        {/* Deployed at — hero table per §5.4 */}
        <Panel title="Deployed at" count={deps.length}>
          {deps.length === 0 ? (
            <p className="px-5 py-5 text-ink-3 text-sm">
              Nothing deployed from this template yet.
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-line text-ink-3 uppercase tracking-[0.06em] text-[11px]">
                  <th className="text-left h-10 px-5 font-medium">Customer</th>
                  <th className="text-left h-10 px-5 font-medium">Agent</th>
                  <th className="text-right h-10 px-4 font-medium">Customization</th>
                  <th className="text-right h-10 px-4 font-medium">Hrs/wk</th>
                  <th className="text-right h-10 px-5 font-medium">Deployed</th>
                </tr>
              </thead>
              <tbody>
                {deps.map((d) => {
                  const c = cById.get(d.customer_id);
                  return (
                    <tr
                      key={d.id}
                      className="border-b border-line last:border-b-0 hover:bg-surface-1 transition-colors duration-instant"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/customers/${c?.id ?? ""}`}
                          className="font-sans font-medium text-[15px] text-ink hover:underline underline-offset-2 decoration-line"
                        >
                          {c?.name ?? "—"}
                        </Link>
                        <div className="mt-0.5 text-sm text-ink-2">{d.agent_name}</div>
                      </td>
                      <td className="px-5 py-4 text-ink-2 text-sm hidden md:table-cell">
                        {d.agent_name}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="inline-flex flex-col items-end gap-1">
                          <span className="num text-sm text-ink-2">{d.customization_pct}%</span>
                          {/* Customization progress bar */}
                          <div
                            className="h-1 w-16 rounded-full bg-surface-2 overflow-hidden"
                            aria-hidden
                          >
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{ width: `${d.customization_pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 num text-right text-sm text-ink-2">
                        {formatHours(d.hours_replaced_per_week)}
                      </td>
                      <td className="px-5 py-4 num text-right text-xs text-ink-3">
                        {formatDate(d.deployed_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>

        {/* Origin extractions — editorial cards per §5.4 */}
        {relatedExtractions.length > 0 && (
          <Panel title="Origin extractions" count={relatedExtractions.length}>
            <div className="divide-y divide-line">
              {relatedExtractions.map((p) => {
                const sourceEng = engagements.find(
                  (e) => e.id === p.source_engagement_id,
                );
                const sourceCust = sourceEng
                  ? customers.find((c) => c.id === sourceEng.customer_id)
                  : null;
                return (
                  <div key={p.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        {/* Date in JetBrains Mono */}
                        <span className="num text-xs text-ink-3 shrink-0 mb-1 block">
                          {formatDate(p.extracted_at)}
                        </span>
                        {/* Summary as editorial paragraph */}
                        <p className="text-sm text-ink leading-relaxed">
                          {p.source_engagement_summary}
                        </p>
                        {sourceEng && (
                          <div className="mt-1.5 text-xs text-ink-3">
                            source:{" "}
                            <Link
                              href={`/engagements/${sourceEng.id}`}
                              className="text-ink-2 hover:text-ink underline underline-offset-2 decoration-line"
                            >
                              {sourceCust?.name ?? "—"} · {sourceEng.phase}
                            </Link>
                          </div>
                        )}
                      </div>
                      <ExtractionRowDelete extractionId={p.id} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}
      </PageShell>
    </RoleProvider>
  );
}

function StatCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-5">
      <div className="t-eyebrow mb-2">{label}</div>
      <div className="leading-none">{children}</div>
    </div>
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
    <section className="rounded-md bg-canvas shadow-[var(--shadow-base)] overflow-hidden mb-4">
      <header className="flex items-baseline justify-between gap-4 px-5 py-3.5 border-b border-line">
        <div className="flex items-baseline gap-2">
          <h2 className="t-h2">{title}</h2>
          {typeof count === "number" && (
            <span className="num text-xs text-ink-3">{count}</span>
          )}
        </div>
      </header>
      <div>{children}</div>
    </section>
  );
}

// Reuse arc node
function ReuseArcNode({
  label,
  name,
  href,
  subtext,
  variant,
}: {
  label: string;
  name: string;
  href?: string;
  subtext?: string;
  variant: "origin" | "template" | "reuse";
}) {
  const bg: Record<string, string> = {
    origin: "bg-surface-1 border-line",
    template: "bg-accent-soft border-accent",
    reuse: "bg-canvas border-line",
  };

  const content = (
    <div
      className={[
        "rounded-md border px-4 py-3 min-w-[100px] max-w-[150px]",
        bg[variant],
      ].join(" ")}
    >
      <div className="t-eyebrow mb-1">{label}</div>
      <div className="font-sans font-medium text-[13px] text-ink leading-snug line-clamp-2">
        {name}
      </div>
      {subtext && (
        <div className="mt-0.5 num text-[11px] text-ink-3">{subtext}</div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="hover:opacity-80 transition-opacity duration-instant focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] rounded-md"
      >
        {content}
      </Link>
    );
  }
  return content;
}

function ArcArrow() {
  return (
    <div
      className="flex items-center px-2 text-ink-3 shrink-0"
      aria-hidden
    >
      <svg width="20" height="2" viewBox="0 0 20 2" fill="none">
        <line x1="0" y1="1" x2="16" y2="1" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" />
        <path d="M14 0 L18 1 L14 2" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
