import Link from "next/link";
import { notFound } from "next/navigation";
import { TemplateCategoryMenu } from "@/components/controls/template-category-menu";
import { CapabilityEditor } from "@/components/controls/capability-editor";
import { GithubRepoInput } from "@/components/controls/github-repo-input";
import { InlineName } from "@/components/controls/inline-name";
import { LiveUrlInput } from "@/components/controls/live-url-input";
import { TemplateTagsInput } from "@/components/controls/template-tags-input";
import { PageHeader, PageShell } from "@/components/page-shell";
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
  const totalHours = deps.reduce((s, d) => s + d.hours_replaced_per_week, 0);
  const avgCustom =
    deps.length === 0
      ? 0
      : Math.round(
          deps.reduce((s, d) => s + d.customization_pct, 0) / deps.length,
        );

  return (
    <PageShell>
      <PageHeader
        kicker={
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
            <span className="num">{formatDate(tpl.created_at)}</span> by{" "}
            <Link
              href={`/fdes/${author?.id ?? ""}`}
              className="text-ink hover:underline underline-offset-2 decoration-line"
            >
              {author?.name ?? "—"}
            </Link>{" "}
            from work with{" "}
            <Link
              href={`/customers/${origin?.id ?? ""}`}
              className="text-ink hover:underline underline-offset-2 decoration-line"
            >
              {origin?.name ?? "—"}
            </Link>
          </>
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
          </div>
        }
      />

      <section className="border-y border-line py-4 mb-4 flex items-start gap-4">
        <span className="t-caption text-ink-3 pt-1.5 shrink-0">Tags</span>
        <TemplateTagsInput
          templateSlug={tpl.id}
          current={tpl.tags}
          mode="block"
        />
      </section>

      <Panel title="Stats">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-line">
          <Stat label="Deployments">
            <span className="num">{deps.length}</span>
          </Stat>
          <Stat label="Unique customers">
            <span className="num">{customerCount}</span>
          </Stat>
          <Stat label="Hrs / wk replaced">
            <span className="num">{formatHours(totalHours)}</span>
          </Stat>
          <Stat label="Avg customization">
            <span className="num">
              {deps.length === 0 ? "—" : `${avgCustom}%`}
            </span>
          </Stat>
        </div>
      </Panel>

      <Panel title="Capabilities" count={tpl.capabilities.length}>
        <div className="px-3 py-3">
          <CapabilityEditor
            templateSlug={tpl.id}
            fallback={tpl.capabilities}
          />
        </div>
      </Panel>

      <Panel title="Deployed at" count={deps.length}>
        {deps.length === 0 ? (
          <p className="px-3 py-3 text-ink-3 text-[12px]">
            Nothing deployed from this template yet.
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-line text-ink-3 uppercase tracking-[0.06em] text-[10px]">
                <th className="text-left h-8 px-3 font-medium">Customer</th>
                <th className="text-left h-8 px-3 font-medium">Agent</th>
                <th className="text-right h-8 px-3 font-medium">Custom %</th>
                <th className="text-right h-8 px-3 font-medium">Hrs/wk</th>
                <th className="text-right h-8 px-3 font-medium">Deployed</th>
              </tr>
            </thead>
            <tbody>
              {deps.map((d) => {
                const c = cById.get(d.customer_id);
                return (
                  <tr
                    key={d.id}
                    className="border-b border-line last:border-b-0"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/customers/${c?.id ?? ""}`}
                        className="text-ink text-[13.5px] hover:underline underline-offset-2 decoration-line"
                      >
                        {c?.name ?? "—"}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-ink-2 text-[13px]">
                      {d.agent_name}
                    </td>
                    <td className="px-3 py-2 num text-right text-ink-2 text-[12.5px]">
                      {d.customization_pct}%
                    </td>
                    <td className="px-3 py-2 num text-right text-ink-2 text-[12.5px]">
                      {formatHours(d.hours_replaced_per_week)}
                    </td>
                    <td className="px-3 py-2 num text-right text-ink-3 text-[12px]">
                      {formatDate(d.deployed_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      {relatedExtractions.length > 0 && (
        <Panel title="Origin extractions" count={relatedExtractions.length}>
          <ul className="ledger">
            {relatedExtractions.map((p) => (
              <li key={p.id} className="px-3 py-2">
                <div className="flex items-baseline gap-3">
                  <span className="num text-[11px] text-ink-3">
                    {formatDate(p.extracted_at)}
                  </span>
                  <p className="text-[13px] text-ink leading-snug min-w-0 flex-1">
                    {p.source_engagement_summary}
                  </p>
                </div>
              </li>
            ))}
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
