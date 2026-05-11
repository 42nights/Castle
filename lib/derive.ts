import type {
  Customer,
  Deployment,
  Engagement,
  EngagementPhase,
  FDE,
  FounderHoursEntry,
  Health,
  Template,
} from "./types";

/* ─────────────────────────── basics ─────────────────────────── */

export function contractedArr(customers: Customer[]): number {
  return customers.reduce((sum, c) => sum + c.current_mrr * 12, 0);
}

export function payingCustomerCount(customers: Customer[]): number {
  return customers.filter((c) => c.status === "active" && c.current_mrr > 0)
    .length;
}

export function totalHoursReplaced(deployments: Deployment[]): number {
  return deployments.reduce((s, d) => s + d.hours_replaced_per_week, 0);
}

/** ARR sitting on yellow/red customers (or anyone non-green). */
export function atRiskArr(customers: Customer[]): number {
  return customers
    .filter((c) => c.status === "active" && c.health !== "green")
    .reduce((s, c) => s + c.current_mrr * 12, 0);
}

export function activeEngagements(engagements: Engagement[]): Engagement[] {
  return engagements.filter(
    (e) => e.phase === "discovery" || e.phase === "build"
  );
}

export function isEngagementOpen(
  engagement: Engagement,
  customer?: Customer
): boolean {
  if (customer && customer.status === "churned") return false;
  return engagement.phase !== "support";
}

const healthRank: Record<Health, number> = { red: 0, yellow: 1, green: 2 };

export function sortByHealthThenDate<
  T extends { health: Health; start_date: string },
>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const h = healthRank[a.health] - healthRank[b.health];
    if (h !== 0) return h;
    return b.start_date.localeCompare(a.start_date);
  });
}

export function daysSince(iso: string, today: Date = new Date()): number {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00Z" : ""));
  return Math.floor((today.getTime() - d.getTime()) / 86400000);
}

/* ───────────────────────── templates ───────────────────────── */

export type TemplateUsage = {
  template: Template;
  deploymentCount: number;
  customerCount: number;
  customerIds: string[];
};

export function templateUsage(
  templates: Template[],
  deployments: Deployment[]
): TemplateUsage[] {
  return templates.map((t) => {
    const deps = deployments.filter((d) => d.template_id === t.id);
    const customerIds = Array.from(new Set(deps.map((d) => d.customer_id)));
    return {
      template: t,
      deploymentCount: deps.length,
      customerCount: customerIds.length,
      customerIds,
    };
  });
}

export function templatesByMostReused(usage: TemplateUsage[]): TemplateUsage[] {
  return [...usage].sort((a, b) => {
    if (b.deploymentCount !== a.deploymentCount)
      return b.deploymentCount - a.deploymentCount;
    return b.template.created_at.localeCompare(a.template.created_at);
  });
}

/* ──────────────────────── customer rows ───────────────────── */

export type CustomerRow = {
  customer: Customer;
  activeAgents: number;
  templateBasedPct: number;
  hoursReplacedPerWeek: number;
};

export function customerRows(
  customers: Customer[],
  deployments: Deployment[]
): CustomerRow[] {
  return customers
    .map((c) => {
      const ds = deployments.filter((d) => d.customer_id === c.id);
      const tplBased = ds.filter((d) => d.template_id !== null).length;
      return {
        customer: c,
        activeAgents: ds.length,
        templateBasedPct: ds.length === 0 ? 0 : tplBased / ds.length,
        hoursReplacedPerWeek: ds.reduce(
          (s, d) => s + d.hours_replaced_per_week,
          0
        ),
      };
    })
    .sort((a, b) => b.customer.current_mrr - a.customer.current_mrr);
}

/* ─────────────────────── engagement rows ───────────────────── */

export type EngagementRow = {
  engagement: Engagement;
  customer: Customer;
  fdes: FDE[];
};

export function engagementRows(
  engagements: Engagement[],
  customers: Customer[],
  fdes: FDE[]
): EngagementRow[] {
  const cById = new Map(customers.map((c) => [c.id, c]));
  const fById = new Map(fdes.map((f) => [f.id, f]));
  return engagements
    .map((e) => ({
      engagement: e,
      customer: cById.get(e.customer_id)!,
      fdes: e.fde_ids.map((id) => fById.get(id)).filter(Boolean) as FDE[],
    }))
    .filter((r) => r.customer);
}

/* ─────────────────────── FDE workload ──────────────────────── */

export type FdeWorkloadStatus =
  | "available"
  | "healthy"
  | "at capacity"
  | "overcommitted";

export type FdeWorkload = {
  fde: FDE;
  activeEngagements: Engagement[];
  committedHours: number;
  actualHours: number;
  capacityHours: number;
  utilization: number;
  status: FdeWorkloadStatus;
  avgPortfolioHealth: Health | "—";
};

export function fdeWorkload(
  fde: FDE,
  engagements: Engagement[],
  customers: Customer[]
): FdeWorkload {
  const cById = new Map(customers.map((c) => [c.id, c]));
  const active = engagements.filter(
    (e) =>
      e.fde_ids.includes(fde.id) && isEngagementOpen(e, cById.get(e.customer_id))
  );
  const committedHours = active.reduce(
    (sum, e) => sum + e.weekly_hours / Math.max(1, e.fde_ids.length),
    0
  );
  const utilization = committedHours / Math.max(1, fde.capacity_hours_per_week);
  const status: FdeWorkloadStatus =
    utilization < 0.6
      ? "available"
      : utilization < 0.9
        ? "healthy"
        : utilization <= 1.05
          ? "at capacity"
          : "overcommitted";
  let avgPortfolioHealth: Health | "—" = "—";
  if (active.length > 0) {
    const score =
      active.reduce((s, e) => s + healthRank[e.health], 0) / active.length;
    avgPortfolioHealth =
      score < 0.7 ? "red" : score < 1.5 ? "yellow" : "green";
  }
  return {
    fde,
    activeEngagements: active,
    committedHours,
    actualHours: fde.hours_this_week,
    capacityHours: fde.capacity_hours_per_week,
    utilization,
    status,
    avgPortfolioHealth,
  };
}

export function allFdeWorkloads(
  fdes: FDE[],
  engagements: Engagement[],
  customers: Customer[]
): FdeWorkload[] {
  return fdes.map((f) => fdeWorkload(f, engagements, customers));
}

/** Imbalance score: stddev of utilization across FDEs. 0 = perfectly balanced. */
export function loadImbalance(workloads: FdeWorkload[]): number {
  if (workloads.length < 2) return 0;
  const mean =
    workloads.reduce((s, w) => s + w.utilization, 0) / workloads.length;
  const variance =
    workloads.reduce((s, w) => s + (w.utilization - mean) ** 2, 0) /
    workloads.length;
  return Math.sqrt(variance);
}

/* ─────────────────── velocity (last N days) ─────────────────── */

export function deploymentsInLastDays(
  deployments: Deployment[],
  days: number,
  today: Date = new Date()
): Deployment[] {
  return deployments.filter((d) => daysSince(d.deployed_at, today) <= days);
}

export function fdeAgentsShippedRecently(
  fde: FDE,
  deployments: Deployment[],
  engagements: Engagement[],
  days: number,
  today: Date = new Date()
): number {
  const engIds = new Set(
    engagements.filter((e) => e.fde_ids.includes(fde.id)).map((e) => e.id)
  );
  return deployments.filter(
    (d) =>
      engIds.has(d.engagement_id) && daysSince(d.deployed_at, today) <= days
  ).length;
}

/* ─────────────────── phase grouping (kanban) ─────────────────── */

export function engagementsByPhase(
  rows: EngagementRow[]
): Record<EngagementPhase, EngagementRow[]> {
  const out: Record<EngagementPhase, EngagementRow[]> = {
    discovery: [],
    build: [],
    deployed: [],
    support: [],
  };
  for (const r of rows) {
    if (r.customer.status === "churned") continue;
    out[r.engagement.phase].push(r);
  }
  for (const key of Object.keys(out) as EngagementPhase[]) {
    out[key].sort(
      (a, b) =>
        healthRank[a.engagement.health] - healthRank[b.engagement.health]
    );
  }
  return out;
}

/* ─────────────────── attention items ─────────────────── */

export type AttentionSeverity = "critical" | "high" | "medium";

export type AttentionItem = {
  id: string;
  severity: AttentionSeverity;
  title: string;
  subtitle: string;
  customer?: Customer;
  engagement?: Engagement;
  owner?: FDE;
  href: string;
};

const STALL_THRESHOLD_DAYS = 7;
const LONG_DISCOVERY_DAYS = 21;

export function attentionItems(
  engagements: Engagement[],
  customers: Customer[],
  fdes: FDE[],
  today: Date = new Date()
): AttentionItem[] {
  const cById = new Map(customers.map((c) => [c.id, c]));
  const fById = new Map(fdes.map((f) => [f.id, f]));
  const items: AttentionItem[] = [];

  // Churned customers — keep visible until follow-up logged.
  for (const c of customers) {
    if (c.status === "churned") {
      items.push({
        id: `churn-${c.id}`,
        severity: "high",
        title: `${c.name} churned`,
        subtitle: `Lost $${(c.current_mrr * 12).toLocaleString()} ARR run-rate. Log a post-mortem and reach-out plan.`,
        customer: c,
        href: `/customers/${c.id}`,
      });
    }
  }

  for (const e of engagements) {
    const customer = cById.get(e.customer_id);
    if (!customer || customer.status === "churned") continue;
    const owners = e.fde_ids.map((id) => fById.get(id)).filter(Boolean) as FDE[];
    const stale = daysSince(e.last_update_at, today);

    if (e.health === "red") {
      items.push({
        id: `red-${e.id}`,
        severity: "critical",
        title: `${customer.name} engagement is red`,
        subtitle: e.notes.split(".")[0] + ".",
        customer,
        engagement: e,
        owner: owners[0],
        href: `/engagements/${e.id}`,
      });
    } else if (e.health === "yellow") {
      items.push({
        id: `yellow-${e.id}`,
        severity: "high",
        title: `${customer.name} flagged yellow`,
        subtitle: e.notes.split(".")[0] + ".",
        customer,
        engagement: e,
        owner: owners[0],
        href: `/engagements/${e.id}`,
      });
    }

    if (e.phase === "discovery") {
      const age = daysSince(e.start_date, today);
      if (age > LONG_DISCOVERY_DAYS) {
        items.push({
          id: `disco-${e.id}`,
          severity: "high",
          title: `${customer.name} stuck in discovery (${age}d)`,
          subtitle: "Cut scope or move to build. Discovery beyond 21 days bleeds margin.",
          customer,
          engagement: e,
          owner: owners[0],
          href: `/engagements/${e.id}`,
        });
      }
    }

    if (stale > STALL_THRESHOLD_DAYS && e.phase !== "support") {
      items.push({
        id: `stale-${e.id}`,
        severity: e.health === "red" ? "critical" : "medium",
        title: `${customer.name} not updated in ${stale}d`,
        subtitle: `Last note ${e.last_update_at}. Either push the work or update the log.`,
        customer,
        engagement: e,
        owner: owners[0],
        href: `/engagements/${e.id}`,
      });
    }
  }

  // FDE overcommitment.
  const workloads = allFdeWorkloads(fdes, engagements, customers);
  for (const w of workloads) {
    if (w.status === "overcommitted") {
      items.push({
        id: `overcommit-${w.fde.id}`,
        severity: "medium",
        title: `${w.fde.name} overcommitted (${Math.round(w.utilization * 100)}%)`,
        subtitle: `Committed ${w.committedHours.toFixed(0)}h / ${w.capacityHours}h cap. Reassign or push back on a scope.`,
        owner: w.fde,
        href: `/fdes/${w.fde.id}`,
      });
    }
  }

  // Dedup + severity sort.
  const seen = new Set<string>();
  const deduped = items.filter((i) => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });
  const severityRank: Record<AttentionSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
  };
  deduped.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  return deduped;
}

/* ─────────────────── FDE list table ─────────────────── */

export type FdeRow = {
  fde: FDE;
  workload: FdeWorkload;
};

export function fdeRows(
  fdes: FDE[],
  engagements: Engagement[],
  customers: Customer[]
): FdeRow[] {
  return fdes.map((f) => ({ fde: f, workload: fdeWorkload(f, engagements, customers) }));
}

/* ─────────────────── founder leverage chart ─────────────────── */

export type FounderHoursPoint = {
  month: string;
  founder_hours_total: number;
  new_arr_dollars: number;
  hoursPerArrK: number | null;
  target: number;
};

export function founderHoursSeries(
  entries: FounderHoursEntry[]
): FounderHoursPoint[] {
  const sorted = [...entries].sort((a, b) => a.month.localeCompare(b.month));
  const base = sorted.map((e) => ({
    month: e.month,
    founder_hours_total: e.founder_hours_total,
    new_arr_dollars: e.new_arr_dollars,
    hoursPerArrK:
      e.new_arr_dollars > 0
        ? e.founder_hours_total / (e.new_arr_dollars / 1000)
        : null,
  }));
  const real = base.map((b) => b.hoursPerArrK).filter((v): v is number => v !== null);
  if (real.length === 0) return base.map((b) => ({ ...b, target: 0 }));

  const start = real[0]!;
  const end = start * 0.5;
  const n = base.length;
  return base.map((b, i) => ({
    ...b,
    target: start + ((end - start) * i) / Math.max(1, n - 1),
  }));
}
