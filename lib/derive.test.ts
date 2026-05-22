import { describe, expect, it } from "vitest";
import {
  atRiskArr,
  contractedArr,
  customerRows,
  daysSince,
  fdeWorkload,
  founderHoursSeries,
  payingCustomerCount,
  templateUsage,
  templatesByMostReused,
  totalHoursReplaced,
} from "./derive";
import type {
  Customer,
  Deployment,
  Engagement,
  FDE,
  FounderHoursEntry,
  Template,
} from "./types";

/* ─────────────────────── fixtures ─────────────────────── */

const customer = (overrides: Partial<Customer> = {}): Customer => ({
  id: "c1",
  name: "Customer 1",
  backed_by: [],
  start_date: "2026-01-01",
  status: "active",
  current_mrr: 1000,
  is_pe: false,
  health: "green",
  ...overrides,
});

const engagement = (overrides: Partial<Engagement> = {}): Engagement => ({
  id: "e1",
  customer_id: "c1",
  fde_ids: ["jerry"],
  start_date: "2026-04-01",
  expected_end_date: "2026-06-01",
  last_update_at: "2026-05-01",
  phase: "build",
  progress_pct: 50,
  weekly_hours: 20,
  health: "green",
  notes: "",
  deployment_ids: [],
  ...overrides,
});

const fde = (overrides: Partial<FDE> = {}): FDE => ({
  id: "jerry",
  name: "Jerry X",
  role: "Founder",
  is_founder: true,
  start_date: "2026-01-01",
  hours_this_week: 40,
  capacity_hours_per_week: 45,
  agents_shipped_total: 0,
  templates_authored: 0,
  tags: [],
  ...overrides,
});

const deployment = (overrides: Partial<Deployment> = {}): Deployment => ({
  id: "d1",
  customer_id: "c1",
  engagement_id: "e1",
  template_id: null,
  agent_name: "agent",
  deployed_at: "2026-05-01",
  hours_replaced_per_week: 8,
  customization_pct: 0,
  ...overrides,
});

const template = (overrides: Partial<Template> = {}): Template => ({
  id: "t1",
  name: "t",
  category: "Ops",
  capabilities: [],
  created_at: "2026-04-01",
  origin_customer_id: "c1",
  authored_by_fde_id: "jerry",
  tags: [],
  ...overrides,
});

/* ─────────────────────── basics ─────────────────────── */

describe("contractedArr", () => {
  it("sums current_mrr × 12", () => {
    expect(
      contractedArr([
        customer({ current_mrr: 1000 }),
        customer({ id: "c2", current_mrr: 500 }),
      ]),
    ).toBe(18_000);
  });
  it("returns 0 for empty", () => {
    expect(contractedArr([])).toBe(0);
  });
});

describe("payingCustomerCount", () => {
  it("counts active with mrr > 0", () => {
    expect(
      payingCustomerCount([
        customer({ current_mrr: 1000 }),
        customer({ id: "c2", current_mrr: 0 }),
        customer({ id: "c3", status: "churned", current_mrr: 0 }),
        customer({ id: "c4", status: "paused", current_mrr: 500 }),
      ]),
    ).toBe(1);
  });
});

describe("totalHoursReplaced", () => {
  it("sums per-deployment hours", () => {
    expect(
      totalHoursReplaced([
        deployment({ hours_replaced_per_week: 8 }),
        deployment({ id: "d2", hours_replaced_per_week: 4 }),
      ]),
    ).toBe(12);
  });
});

/* ─────────────────────── P15 fix: atRiskArr includes paused ─────────────────────── */

describe("atRiskArr", () => {
  it("counts active non-green MRR", () => {
    expect(
      atRiskArr([
        customer({ health: "red", current_mrr: 2000 }),
        customer({ id: "c2", health: "yellow", current_mrr: 500 }),
        customer({ id: "c3", health: "green", current_mrr: 9999 }),
      ]),
    ).toBe(2500 * 12);
  });

  it("INCLUDES paused non-green customers (was a bug)", () => {
    // Paused is itself a risk signal — we stopped delivering for a reason.
    // Previously this row was silently excluded.
    expect(
      atRiskArr([
        customer({ status: "paused", health: "yellow", current_mrr: 1000 }),
      ]),
    ).toBe(12_000);
  });

  it("excludes churned (loss is realized, not at-risk)", () => {
    expect(
      atRiskArr([
        customer({ status: "churned", health: "red", current_mrr: 0 }),
      ]),
    ).toBe(0);
  });

  it("excludes green customers regardless of status", () => {
    expect(
      atRiskArr([
        customer({ status: "paused", health: "green", current_mrr: 1000 }),
      ]),
    ).toBe(0);
  });
});

/* ─────────────────────── P15 fix: daysSince clamps future ─────────────────────── */

describe("daysSince", () => {
  const today = new Date("2026-05-11T12:00:00Z");

  it("returns the integer day count for past timestamps", () => {
    expect(daysSince("2026-05-04", today)).toBe(7);
    expect(daysSince("2026-05-11", today)).toBe(0);
  });

  it("CLAMPS future timestamps to 0 (was a bug)", () => {
    // A typo into 2099 would otherwise return negative, making
    // `stale > 7` permanently false and suppressing alerts.
    expect(daysSince("2099-01-01", today)).toBe(0);
    expect(daysSince("2026-05-12", today)).toBe(0);
  });

  it("handles ISO timestamps with hours", () => {
    expect(daysSince("2026-05-04T12:00:00Z", today)).toBe(7);
  });
});

/* ─────────────────────── P15 fix: founderHoursSeries dedupes ─────────────────────── */

describe("founderHoursSeries", () => {
  const entry = (
    overrides: Partial<FounderHoursEntry> = {},
  ): FounderHoursEntry => ({
    month: "2026-01",
    founder_hours_total: 100,
    new_arr_dollars: 10_000,
    ...overrides,
  });

  it("emits one point per entry, computes hoursPerArrK", () => {
    const out = founderHoursSeries([
      entry({ month: "2026-01", founder_hours_total: 100, new_arr_dollars: 10_000 }),
      entry({ month: "2026-02", founder_hours_total: 80, new_arr_dollars: 20_000 }),
    ]);
    expect(out.map((p) => p.month)).toEqual(["2026-01", "2026-02"]);
    expect(out[0].hoursPerArrK).toBe(10); // 100 / (10000/1000)
    expect(out[1].hoursPerArrK).toBe(4); // 80 / (20000/1000)
  });

  it("emits null hoursPerArrK when new_arr_dollars is 0", () => {
    const out = founderHoursSeries([
      entry({ month: "2026-01", new_arr_dollars: 0 }),
    ]);
    expect(out[0].hoursPerArrK).toBeNull();
  });

  it("DEDUPES duplicate months (was a bug — skewed target slope)", () => {
    const out = founderHoursSeries([
      entry({ month: "2026-01", founder_hours_total: 100 }),
      entry({ month: "2026-01", founder_hours_total: 999 }), // dup, last wins
      entry({ month: "2026-02" }),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].founder_hours_total).toBe(999);
  });

  it("sorts out-of-order input chronologically", () => {
    const out = founderHoursSeries([
      entry({ month: "2026-03" }),
      entry({ month: "2026-01" }),
      entry({ month: "2026-02" }),
    ]);
    expect(out.map((p) => p.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("draws a 50% reduction target between first and last points", () => {
    const out = founderHoursSeries([
      entry({ month: "2026-01", founder_hours_total: 100, new_arr_dollars: 10_000 }),
      entry({ month: "2026-02", founder_hours_total: 100, new_arr_dollars: 10_000 }),
      entry({ month: "2026-03", founder_hours_total: 100, new_arr_dollars: 10_000 }),
    ]);
    expect(out[0].target).toBeCloseTo(10);
    expect(out[2].target).toBeCloseTo(5);
    expect(out[1].target).toBeCloseTo(7.5);
  });
});

/* ─────────────────────── workload ─────────────────────── */

describe("fdeWorkload", () => {
  it("splits engagement weekly_hours across the team", () => {
    const f = fde({ id: "jerry", capacity_hours_per_week: 40 });
    const ayaan = fde({ id: "ayaan" });
    const e = engagement({
      id: "e1",
      fde_ids: ["jerry", "ayaan"],
      weekly_hours: 40,
    });
    const c = customer({ id: "c1" });
    const w = fdeWorkload(f, [e], [c]);
    expect(w.committedHours).toBe(20); // 40 / 2
    expect(w.utilization).toBeCloseTo(20 / 40);
    expect(w.status).toBe("available");
  });

  it("marks overcommitted past 105%", () => {
    const f = fde({ capacity_hours_per_week: 40 });
    const e = engagement({ weekly_hours: 50 });
    const w = fdeWorkload(f, [e], [customer()]);
    expect(w.committedHours).toBe(50);
    expect(w.status).toBe("overcommitted");
  });

  it("excludes engagements with churned customers", () => {
    const f = fde();
    const e = engagement({ weekly_hours: 30 });
    const c = customer({ status: "churned" });
    const w = fdeWorkload(f, [e], [c]);
    expect(w.committedHours).toBe(0);
    expect(w.activeEngagements).toHaveLength(0);
  });

  it("returns 0 commitment for FDE with no engagements", () => {
    const w = fdeWorkload(fde(), [], []);
    expect(w.committedHours).toBe(0);
    expect(w.status).toBe("available");
    expect(w.avgPortfolioHealth).toBe("—");
  });
});

/* ─────────────────────── customer rows ─────────────────────── */

describe("customerRows", () => {
  it("sorts by current_mrr desc", () => {
    const rows = customerRows(
      [
        customer({ id: "small", current_mrr: 100 }),
        customer({ id: "big", current_mrr: 5000 }),
      ],
      [],
    );
    expect(rows.map((r) => r.customer.id)).toEqual(["big", "small"]);
  });

  it("computes templateBasedPct from deployments", () => {
    const rows = customerRows(
      [customer({ id: "c1" })],
      [
        deployment({ template_id: "t1" }),
        deployment({ id: "d2", template_id: null }),
      ],
    );
    expect(rows[0].activeAgents).toBe(2);
    expect(rows[0].templateBasedPct).toBe(0.5);
  });

  it("returns 0 templateBasedPct for customers with no deployments (no NaN)", () => {
    const rows = customerRows([customer()], []);
    expect(rows[0].templateBasedPct).toBe(0);
  });
});

/* ─────────────────────── template usage ─────────────────────── */

describe("templatesByMostReused", () => {
  it("sorts by deploymentCount desc, then by created_at desc", () => {
    const tA = template({ id: "a", created_at: "2026-01-01" });
    const tB = template({ id: "b", created_at: "2026-02-01" });
    const tC = template({ id: "c", created_at: "2026-03-01" });
    const usage = templateUsage(
      [tA, tB, tC],
      [
        deployment({ template_id: "a" }),
        deployment({ id: "d2", template_id: "a" }),
        deployment({ id: "d3", template_id: "b" }),
      ],
    );
    const ranked = templatesByMostReused(usage);
    expect(ranked.map((u) => u.template.id)).toEqual(["a", "b", "c"]);
  });
});
