import Link from "next/link";
import { notFound } from "next/navigation";
import { HealthPip, StatusChip } from "@/components/atoms";
import { PageHeader, PageShell } from "@/components/page-shell";
import { EngagementKeys } from "@/components/controls/engagement-keys";
import { EngagementDocument } from "@/components/engagements/engagement-document";
import { loadOverview } from "@/lib/load-overview";
import { formatUsd } from "@/lib/format";

export default async function EngagementDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const {
    engagements,
    customers,
    fdes,
    deployments,
    templates,
    patternExtractions,
  } = await loadOverview();

  const eng = engagements.find((e) => e.id === slug);
  if (!eng) notFound();

  const customer = customers.find((c) => c.id === eng.customer_id)!;
  const team = eng.fde_ids
    .map((fid) => fdes.find((f) => f.id === fid))
    .filter(Boolean) as typeof fdes;
  const deps = deployments.filter((d) => d.engagement_id === eng.id);
  const tplById = new Map(templates.map((t) => [t.id, t]));
  const relatedExtractions = patternExtractions.filter(
    (p) => p.source_engagement_id === eng.id
  );

  return (
    <PageShell>
      {/* Keyboard shortcuts (u to mark touched, etc.) */}
      <EngagementKeys engagementSlug={eng.id} />

      <PageHeader
        variant="operator"
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
            <span className="num text-ink">{formatUsd(customer.current_mrr)}</span>
          </>
        }
        actions={
          <div className="flex items-center gap-3">
            <HealthPip value={eng.health} label={`Health · ${eng.health}`} />
            <StatusChip status={customer.status} />
          </div>
        }
      />

      {/* Notion-style document: notes body + sticky side rail + panels below */}
      <EngagementDocument
        eng={eng}
        customer={customer}
        team={team}
        deps={deps}
        tplById={tplById}
        relatedExtractions={relatedExtractions}
      />
    </PageShell>
  );
}
