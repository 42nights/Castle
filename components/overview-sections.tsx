import { PageShell } from "@/components/page-shell";
import { AttentionList } from "@/components/sections/attention";
import { AttentionListLive } from "@/components/sections/attention-live";
import { HeroMetrics } from "@/components/sections/hero-metrics";
import { FdeWorkloadBoard } from "@/components/sections/fde-workload-board";
import { PhaseColumns } from "@/components/sections/phase-columns";
import { MrrChart } from "@/components/sections/mrr-chart";
import { TemplateOverview } from "@/components/sections/template-overview";
import { ExtractionTimeline } from "@/components/sections/extraction-timeline";
import {
  allFdeWorkloads,
  atRiskArr,
  attentionItems,
  contractedArr,
  engagementRows,
  engagementsByPhase,
  fdeAgentsShippedRecently,
  loadImbalance,
  mrrDailySeries,
  payingCustomerCount,
  templateUsage,
  totalHoursReplaced,
} from "@/lib/derive";
import type { AdaptedOverview } from "@/lib/adapters";
import type {
  Customer,
  Deployment,
  Engagement,
  FDE,
  PatternExtraction,
  Template,
} from "@/lib/types";

type OverviewData =
  | AdaptedOverview
  | {
      fdes: FDE[];
      customers: Customer[];
      engagements: Engagement[];
      templates: Template[];
      deployments: Deployment[];
      patternExtractions: PatternExtraction[];
    };

export function OverviewSections({
  data,
  liveAttention = false,
}: {
  data: OverviewData;
  liveAttention?: boolean;
}) {
  const { fdes, customers, engagements, templates, deployments, patternExtractions } = data;
  const today = new Date("2026-05-11T12:00:00Z");

  const arr = contractedArr(customers);
  const paying = payingCustomerCount(customers);
  const risk = atRiskArr(customers);
  const hours = totalHoursReplaced(deployments);
  const usage = templateUsage(templates, deployments, patternExtractions);
  const mrrPoints = mrrDailySeries(customers, 90, new Date());
  const allRows = engagementRows(engagements, customers, fdes);
  const phaseGroups = engagementsByPhase(allRows);
  const attention = attentionItems(engagements, customers, fdes, today);
  const workloads = allFdeWorkloads(fdes, engagements, customers);
  const imbalance = loadImbalance(workloads);
  void hours;
  const utilAvg =
    workloads.length === 0
      ? 0
      : workloads.reduce((s, w) => s + w.utilization, 0) / workloads.length;
  const weeklyShipsByFde = Object.fromEntries(
    fdes.map((f) => [
      f.id,
      fdeAgentsShippedRecently(f, deployments, engagements, 7, today),
    ])
  );

  return (
    <PageShell>
      <HeroMetrics
        mrr={mrrPoints.at(-1)?.mrr ?? 0}
        mrrDelta={
          mrrPoints.length >= 2
            ? (mrrPoints.at(-1)?.mrr ?? 0) - (mrrPoints[0]?.mrr ?? 0)
            : 0
        }
        mrrPoints={mrrPoints}
        payingCustomers={paying}
        contractedArr={arr}
        atRiskArr={risk}
        utilization={utilAvg}
        attentionCount={attention.length}
        criticalCount={attention.filter((a) => a.severity === "critical").length}
      />

      {liveAttention ? <AttentionListLive /> : <AttentionList items={attention} />}

      <PhaseColumns groups={phaseGroups} today={today} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <FdeWorkloadBoard
          workloads={workloads}
          weeklyShipsByFde={weeklyShipsByFde}
          imbalance={imbalance}
        />
        <div className="flex flex-col gap-4">
          <TemplateOverview usage={usage} customers={customers} limit={5} />
          <ExtractionTimeline
            extractions={patternExtractions}
            customers={customers}
            templates={templates}
            limit={3}
            showLinkAll
          />
        </div>
      </div>

      <MrrChart points={mrrPoints} />
    </PageShell>
  );
}
