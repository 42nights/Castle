import { PageHeader, PageShell } from "@/components/page-shell";
import { AttentionList } from "@/components/sections/attention";
import { AttentionListLive } from "@/components/sections/attention-live";
import { StatsStrip } from "@/components/sections/stats-strip";
import { FdeWorkloadBoard } from "@/components/sections/fde-workload-board";
import { PhaseColumns } from "@/components/sections/phase-columns";
import { FounderHoursChart } from "@/components/sections/founder-hours-chart";
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
  founderHoursSeries,
  loadImbalance,
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
  FounderHoursEntry,
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
      founderHours: FounderHoursEntry[];
    };

export function OverviewSections({
  data,
  liveAttention = false,
}: {
  data: OverviewData;
  liveAttention?: boolean;
}) {
  const { fdes, customers, engagements, templates, deployments, patternExtractions, founderHours } = data;
  const today = new Date("2026-05-11T12:00:00Z");

  const arr = contractedArr(customers);
  const paying = payingCustomerCount(customers);
  const risk = atRiskArr(customers);
  const hours = totalHoursReplaced(deployments);
  const usage = templateUsage(templates, deployments);
  const points = founderHoursSeries(founderHours);
  const allRows = engagementRows(engagements, customers, fdes);
  const phaseGroups = engagementsByPhase(allRows);
  const attention = attentionItems(engagements, customers, fdes, today);
  const workloads = allFdeWorkloads(fdes, engagements, customers);
  const imbalance = loadImbalance(workloads);
  void hours; // formerly surfaced in stats; removed per design system
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
      <PageHeader
        title="Overview"
        description="Engagements, FDE load, templates, and founder hours — current state."
      />

      {liveAttention ? <AttentionListLive /> : <AttentionList items={attention} />}

      <StatsStrip
        payingCustomers={paying}
        contractedArr={arr}
        atRisk={risk}
        templateCount={templates.length}
        utilizationAvg={utilAvg}
      />

      <FdeWorkloadBoard
        workloads={workloads}
        weeklyShipsByFde={weeklyShipsByFde}
        imbalance={imbalance}
      />

      <PhaseColumns groups={phaseGroups} today={today} />

      <FounderHoursChart points={points} />

      <TemplateOverview usage={usage} customers={customers} limit={6} />

      <ExtractionTimeline
        extractions={patternExtractions}
        customers={customers}
        templates={templates}
        limit={5}
        showLinkAll
      />
    </PageShell>
  );
}
