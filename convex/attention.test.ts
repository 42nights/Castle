import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = (
  import.meta as unknown as {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>;
  }
).glob("./**/*.{ts,js}");

function setup() {
  return convexTest(schema, modules);
}

function bucket(date: Date) {
  return Math.floor(date.getTime() / 60_000);
}

async function seedScene(t: ReturnType<typeof setup>) {
  // A small but representative graph for attention rules.
  return t.run(async (ctx) => {
    const now = "2026-05-11T12:00:00.000Z";

    const jerry = await ctx.db.insert("fdes", {
      name: "Jerry X",
      role: "Founder",
      is_founder: true,
      start_date: "2026-04-01",
      hours_this_week: 38,
      capacity_hours_per_week: 45,
      agents_shipped_total: 0,
      templates_authored: 0,
      slug: "jerry",
      created_at: now,
      updated_at: now,
      updated_by_fde_id: null,
    });
    const ayaan = await ctx.db.insert("fdes", {
      name: "Ayaan Gazali",
      role: "Founder",
      is_founder: true,
      start_date: "2026-04-01",
      hours_this_week: 36,
      capacity_hours_per_week: 45,
      agents_shipped_total: 0,
      templates_authored: 0,
      slug: "ayaan",
      created_at: now,
      updated_at: now,
      updated_by_fde_id: null,
    });

    const eragon = await ctx.db.insert("customers", {
      name: "Eragon",
      backed_by: ["Y Combinator"],
      start_date: "2026-03-22",
      status: "active",
      current_mrr: 3500,
      is_pe: false,
      health: "green",
      slug: "eragon",
      created_at: now,
      updated_at: now,
      updated_by_fde_id: null,
    });
    const custB = await ctx.db.insert("customers", {
      name: "Customer B",
      backed_by: ["Lightspeed"],
      start_date: "2026-04-21",
      status: "active",
      current_mrr: 500,
      is_pe: false,
      health: "red",
      slug: "cust-b",
      created_at: now,
      updated_at: now,
      updated_by_fde_id: null,
    });
    const unique = await ctx.db.insert("customers", {
      name: "UniqueHuman",
      backed_by: ["Afore"],
      start_date: "2026-04-26",
      status: "churned",
      current_mrr: 0,
      is_pe: false,
      health: "red",
      slug: "uniquehuman",
      created_at: now,
      updated_at: now,
      updated_by_fde_id: null,
    });

    // Red engagement, fresh (not stale)
    const engRed = await ctx.db.insert("engagements", {
      customer_id: custB,
      start_date: "2026-04-21",
      expected_end_date: "2026-05-28",
      last_update_at: "2026-05-10",
      phase: "build",
      progress_pct: 32,
      weekly_hours: 10,
      health: "red",
      notes_current: "Champion gone. Re-orienting.",
      notes_version: 1,
      slug: "eng-cust-b",
      created_at: now,
      updated_at: now,
      updated_by_fde_id: null,
    });
    await ctx.db.insert("engagement_assignments", {
      engagement_id: engRed,
      fde_id: ayaan,
      assigned_at: "2026-04-21",
      removed_at: null,
      allocation_hours: null,
    });

    // Stale (>7d) green engagement
    const engStale = await ctx.db.insert("engagements", {
      customer_id: eragon,
      start_date: "2026-03-22",
      expected_end_date: "2026-05-30",
      last_update_at: "2026-05-01", // 10d stale from today
      phase: "deployed",
      progress_pct: 100,
      weekly_hours: 6,
      health: "green",
      notes_current: "Salesforce CPQ live.",
      notes_version: 1,
      slug: "eng-eragon",
      created_at: now,
      updated_at: now,
      updated_by_fde_id: null,
    });
    await ctx.db.insert("engagement_assignments", {
      engagement_id: engStale,
      fde_id: jerry,
      assigned_at: "2026-03-22",
      removed_at: null,
      allocation_hours: null,
    });

    return { jerry, ayaan, engRed, engStale, eragon, custB, unique };
  });
}

const TODAY = new Date("2026-05-11T12:00:00.000Z");
const NOW_BUCKET = bucket(TODAY);

describe("attention.list — derivation", () => {
  it("surfaces churned customers as a 'high' attention row", async () => {
    const t = setup();
    await seedScene(t);
    const items = await t.query(api.attention.list, {
      nowBucket: NOW_BUCKET,
    });
    const churn = items.find((i) => i.item_key === "churn:uniquehuman");
    expect(churn).toBeDefined();
    expect(churn?.severity).toBe("high");
  });

  it("surfaces red engagements as 'critical'", async () => {
    const t = setup();
    await seedScene(t);
    const items = await t.query(api.attention.list, {
      nowBucket: NOW_BUCKET,
    });
    const red = items.find((i) => i.item_key === "red-eng:eng-cust-b");
    expect(red).toBeDefined();
    expect(red?.severity).toBe("critical");
  });

  it("surfaces stale-eng items only for non-support engagements past 7d", async () => {
    const t = setup();
    await seedScene(t);
    const items = await t.query(api.attention.list, {
      nowBucket: NOW_BUCKET,
    });
    // engStale is deployed (not support), last_update_at 2026-05-01 (10d).
    // Should appear as a stale-eng item.
    const stale = items.find((i) => i.item_key === "stale-eng:eng-eragon");
    expect(stale).toBeDefined();
    // Red engagement was last_update 2026-05-10 (1d), not stale.
    expect(items.find((i) => i.item_key === "stale-eng:eng-cust-b")).toBeUndefined();
  });

  it("excludes engagements for churned customers entirely", async () => {
    const t = setup();
    await seedScene(t);
    const items = await t.query(api.attention.list, {
      nowBucket: NOW_BUCKET,
    });
    // No red-eng / stale-eng item for the churned UniqueHuman customer.
    expect(items.some((i) => i.item_key.includes("uniquehuman") &&
      i.source === "derived" && i.item_key.startsWith("red-eng:"))).toBe(false);
  });

  it("sorts items by severity (critical < high < medium)", async () => {
    const t = setup();
    await seedScene(t);
    const items = await t.query(api.attention.list, {
      nowBucket: NOW_BUCKET,
    });
    const sevs = items.map((i) => i.severity);
    const rank = { critical: 0, high: 1, medium: 2 };
    for (let i = 1; i < sevs.length; i++) {
      expect(rank[sevs[i]]).toBeGreaterThanOrEqual(rank[sevs[i - 1]]);
    }
  });
});

describe("attention.snooze + resolve", () => {
  it("drops a snoozed item until snooze_until passes", async () => {
    const t = setup();
    const { jerry } = await seedScene(t);
    // Snooze the red engagement for 24h
    const until = new Date(TODAY.getTime() + 24 * 3600 * 1000).toISOString();
    await t.mutation(api.attention.snooze, {
      item_key: "red-eng:eng-cust-b",
      until,
      reason: "snoozed",
      actor_fde_id: jerry,
    });
    let items = await t.query(api.attention.list, {
      nowBucket: NOW_BUCKET,
    });
    expect(items.find((i) => i.item_key === "red-eng:eng-cust-b")).toBeUndefined();

    // 25h later → reappears
    const future = new Date(TODAY.getTime() + 25 * 3600 * 1000);
    // attention.list uses server Date.now() since P13 fix; we can't shift
    // server clock easily — instead, set the snooze to a past time and
    // re-list to prove the resurfacing logic works.
    const past = new Date(TODAY.getTime() - 1000).toISOString();
    await t.mutation(api.attention.snooze, {
      item_key: "red-eng:eng-cust-b",
      until: past,
      reason: "snoozed",
      actor_fde_id: jerry,
    });
    items = await t.query(api.attention.list, {
      nowBucket: bucket(future),
    });
    expect(items.find((i) => i.item_key === "red-eng:eng-cust-b")).toBeDefined();
  });

  it("resolve writes a +1y snooze so the item stays hidden", async () => {
    const t = setup();
    const { jerry } = await seedScene(t);
    await t.mutation(api.attention.resolve, {
      item_key: "red-eng:eng-cust-b",
      actor_fde_id: jerry,
    });
    const dismissals = await t.run(async (ctx) =>
      ctx.db.query("attention_dismissals").collect(),
    );
    expect(dismissals).toHaveLength(1);
    expect(dismissals[0].reason).toBe("resolved");
    // snooze_until should be ~1 year out
    const until = new Date(dismissals[0].snooze_until).getTime();
    const oneYearMs = 365 * 24 * 3600 * 1000;
    expect(until - Date.now()).toBeGreaterThan(oneYearMs * 0.9);
  });

  it("re-snoozing the same item_key patches existing row (no duplicate)", async () => {
    const t = setup();
    const { jerry } = await seedScene(t);
    const a = new Date(TODAY.getTime() + 3600 * 1000).toISOString();
    const b = new Date(TODAY.getTime() + 2 * 3600 * 1000).toISOString();
    await t.mutation(api.attention.snooze, {
      item_key: "red-eng:eng-cust-b",
      until: a,
      reason: "snoozed",
      actor_fde_id: jerry,
    });
    await t.mutation(api.attention.snooze, {
      item_key: "red-eng:eng-cust-b",
      until: b,
      reason: "snoozed",
      actor_fde_id: jerry,
    });
    const rows = await t.run(async (ctx) =>
      ctx.db.query("attention_dismissals").collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].snooze_until).toBe(b);
  });

  it("clearSnooze deletes the dismissal so the item resurfaces", async () => {
    const t = setup();
    const { jerry } = await seedScene(t);
    await t.mutation(api.attention.resolve, {
      item_key: "red-eng:eng-cust-b",
      actor_fde_id: jerry,
    });
    expect(
      (
        await t.query(api.attention.list, { nowBucket: NOW_BUCKET })
      ).find((i) => i.item_key === "red-eng:eng-cust-b"),
    ).toBeUndefined();
    await t.mutation(api.attention.clearSnooze, {
      item_key: "red-eng:eng-cust-b",
    });
    expect(
      (
        await t.query(api.attention.list, { nowBucket: NOW_BUCKET })
      ).find((i) => i.item_key === "red-eng:eng-cust-b"),
    ).toBeDefined();
  });
});

describe("attention manual items", () => {
  it("merges open manual items into list, drops resolved ones", async () => {
    const t = setup();
    const { jerry } = await seedScene(t);
    const id = await t.mutation(api.attention.createManualItem, {
      title: "Call PE-H champion",
      subtitle: "next Tuesday",
      severity: "medium",
      owner_fde_id: jerry,
      related_customer_id: null,
      related_engagement_id: null,
      href: "/",
      actor_fde_id: jerry,
    });
    let items = await t.query(api.attention.list, { nowBucket: NOW_BUCKET });
    expect(items.some((i) => i.title === "Call PE-H champion")).toBe(true);

    await t.mutation(api.attention.resolveManualItem, {
      id,
      actor_fde_id: jerry,
    });
    items = await t.query(api.attention.list, { nowBucket: NOW_BUCKET });
    expect(items.some((i) => i.title === "Call PE-H champion")).toBe(false);
  });
});

describe("seed.importPayload idempotency", () => {
  function payload() {
    return JSON.stringify({
      fdes: [
        {
          id: "jerry",
          name: "Jerry X",
          role: "Founder",
          is_founder: true,
          start_date: "2026-04-01",
          hours_this_week: 38,
          capacity_hours_per_week: 45,
          agents_shipped_total: 0,
          templates_authored: 0,
        },
      ],
      customers: [
        {
          id: "eragon",
          name: "Eragon",
          backed_by: ["YC"],
          start_date: "2026-03-22",
          status: "active",
          current_mrr: 3500,
          is_pe: false,
          health: "green",
        },
      ],
      engagements: [],
      templates: [],
      deployments: [],
      extractions: [],
      founderHours: [],
    });
  }

  it("seeds successfully on an empty DB", async () => {
    const t = setup();
    const res = await t.mutation(
      // @ts-expect-error internal mutation is callable via the test harness
      api.seed.importPayload,
      { payloadJson: payload() },
    );
    expect(res).toEqual({ skipped: false });
    const fdes = await t.run((ctx) => ctx.db.query("fdes").collect());
    expect(fdes).toHaveLength(1);
  });

  it("skips if fdes already populated", async () => {
    const t = setup();
    await t.mutation(
      // @ts-expect-error internal mutation
      api.seed.importPayload,
      { payloadJson: payload() },
    );
    const second = await t.mutation(
      // @ts-expect-error internal mutation
      api.seed.importPayload,
      { payloadJson: payload() },
    );
    expect(second.skipped).toBe(true);
    expect(second.reason).toMatch(/fdes already populated/);
    // Still just 1 fde
    expect(
      (await t.run((ctx) => ctx.db.query("fdes").collect())).length,
    ).toBe(1);
  });

  it("skips if a non-fdes root table is non-empty (P13 fix)", async () => {
    const t = setup();
    // Pre-insert a customer directly so fdes is empty but customers isn't.
    await t.run(async (ctx) => {
      await ctx.db.insert("customers", {
        name: "Pre-existing",
        backed_by: [],
        start_date: "2026-01-01",
        status: "active",
        current_mrr: 0,
        is_pe: false,
        health: "green",
        slug: "pre",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
        updated_by_fde_id: null,
      });
    });
    const res = await t.mutation(
      // @ts-expect-error internal mutation
      api.seed.importPayload,
      { payloadJson: payload() },
    );
    expect(res.skipped).toBe(true);
    expect(res.reason).toMatch(/customers already populated/);
  });
});

// Silence unused-import warnings — Id may be re-used in the future.
void (null as unknown as Id<"fdes">);
