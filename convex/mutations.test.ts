/**
 * Cross-surface backend tests. Focused on bounds, uniqueness, and the
 * non-trivial business logic in each mutation module that ISN'T already
 * covered by engagements.test.ts or attention.test.ts.
 */
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = (
  import.meta as unknown as {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>;
  }
).glob("./**/*.{ts,js}");

function setup() {
  return convexTest(schema, modules);
}

async function seed(t: ReturnType<typeof setup>) {
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
    const customer = await ctx.db.insert("customers", {
      name: "Eragon",
      backed_by: ["YC"],
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
    return { jerry, customer };
  });
}

/* ─────────────────────── customers ─────────────────────── */

describe("customers", () => {
  it("setMrr rejects negative values", async () => {
    const t = setup();
    const { jerry, customer } = await seed(t);
    // setMrr should reject negatives via the existing handler check
    await expect(
      t.mutation(api.customers.setMrr, {
        id: customer,
        current_mrr: -1,
        actor_fde_id: jerry,
      }),
    ).rejects.toThrow();
  });

  it("setHealth + setStatus update the row + bump updated_at", async () => {
    const t = setup();
    const { jerry, customer } = await seed(t);
    const before = await t.run((ctx) => ctx.db.get(customer));
    await new Promise((r) => setTimeout(r, 5));
    await t.mutation(api.customers.setHealth, {
      id: customer,
      health: "red",
      actor_fde_id: jerry,
    });
    await t.mutation(api.customers.setStatus, {
      id: customer,
      status: "paused",
      actor_fde_id: jerry,
    });
    const after = await t.run((ctx) => ctx.db.get(customer));
    expect(after?.health).toBe("red");
    expect(after?.status).toBe("paused");
    expect(after?.updated_at).not.toBe(before?.updated_at);
  });

  it("create generates a slug derived from name", async () => {
    const t = setup();
    const { id: id } = await t.mutation(api.customers.create, {
      name: "Customer With Spaces!",
      backed_by: [],
      start_date: "2026-05-11",
      status: "active",
      current_mrr: 1000,
      is_pe: false,
      health: "green",
      actor_fde_id: null,
    });
    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row?.slug).toBe("customer-with-spaces");
  });
});

/* ─────────────────────── fdes ─────────────────────── */

describe("fdes", () => {
  it("logHours adjusts hours_this_week (clamping at 0)", async () => {
    const t = setup();
    const { jerry } = await seed(t);
    await t.mutation(api.fdes.logHours, {
      id: jerry,
      delta: 5,
      actor_fde_id: jerry,
    });
    let row = await t.run((ctx) => ctx.db.get(jerry));
    expect(row?.hours_this_week).toBe(43);
    // Try going below 0 with a big negative delta — should clamp
    await t.mutation(api.fdes.logHours, {
      id: jerry,
      delta: -999,
      actor_fde_id: jerry,
    });
    row = await t.run((ctx) => ctx.db.get(jerry));
    expect(row?.hours_this_week).toBe(0);
  });

  it("update.capacity_hours_per_week rejects negatives via the patch path", async () => {
    const t = setup();
    const { jerry } = await seed(t);
    await expect(
      t.mutation(api.fdes.update, {
        id: jerry,
        patch: { capacity_hours_per_week: -5 },
        actor_fde_id: jerry,
      }),
    ).rejects.toThrow(/capacity_hours_per_week must be ≥ 0/);
  });
});

/* ─────────────────────── templates ─────────────────────── */

describe("templates", () => {
  it("create writes ordered capabilities (position 1..N)", async () => {
    const t = setup();
    const { jerry, customer } = await seed(t);
    const { id: tpl } = await t.mutation(api.templates.create, {
      name: "Test",
      category: "Ops",
      capabilities: ["first", "second", "third"],
      origin_customer_id: customer,
      authored_by_fde_id: jerry,
      actor_fde_id: jerry,
    });
    const caps = await t.query(api.templates.listCapabilities, {
      template_id: tpl,
    });
    const sorted = [...caps].sort((a, b) => a.position - b.position);
    expect(sorted.map((c) => c.body)).toEqual(["first", "second", "third"]);
    expect(sorted.map((c) => c.position)).toEqual([1, 2, 3]);
  });

  it("addCapability appends with position = max + 1", async () => {
    const t = setup();
    const { jerry, customer } = await seed(t);
    const { id: tpl } = await t.mutation(api.templates.create, {
      name: "T",
      category: "Ops",
      capabilities: ["one", "two"],
      origin_customer_id: customer,
      authored_by_fde_id: jerry,
      actor_fde_id: jerry,
    });
    await t.mutation(api.templates.addCapability, {
      template_id: tpl,
      body: "three",
      actor_fde_id: jerry,
    });
    const caps = await t.query(api.templates.listCapabilities, {
      template_id: tpl,
    });
    const last = [...caps].sort((a, b) => a.position - b.position).at(-1);
    expect(last?.body).toBe("three");
    expect(last?.position).toBe(3);
  });

  it("remove cascades capabilities", async () => {
    const t = setup();
    const { jerry, customer } = await seed(t);
    const { id: tpl } = await t.mutation(api.templates.create, {
      name: "Will Delete",
      category: "Ops",
      capabilities: ["a", "b"],
      origin_customer_id: customer,
      authored_by_fde_id: jerry,
      actor_fde_id: jerry,
    });
    expect(
      (
        await t.query(api.templates.listCapabilities, { template_id: tpl })
      ).length,
    ).toBe(2);
    await t.mutation(api.templates.remove, { id: tpl });
    expect(
      (await t.run((ctx) => ctx.db.query("template_capabilities").collect()))
        .length,
    ).toBe(0);
  });
});

/* ─────────────────────── deployments ─────────────────────── */

describe("deployments", () => {
  it("create rejects negative hours_replaced_per_week (P16 bounds)", async () => {
    const t = setup();
    const { jerry, customer } = await seed(t);
    const { id: eng } = await t.mutation(api.engagements.create, {
      customer_id: customer,
      fde_ids: [jerry],
      start_date: "2026-05-11",
      expected_end_date: "2026-06-15",
      phase: "build",
      progress_pct: 0,
      weekly_hours: 20,
      health: "green",
      notes: "",
      actor_fde_id: jerry,
    });
    await expect(
      t.mutation(api.deployments.create, {
        customer_id: customer,
        engagement_id: eng,
        template_id: null,
        agent_name: "bad",
        deployed_at: "2026-05-11",
        hours_replaced_per_week: -3,
        customization_pct: 0,
      }),
    ).rejects.toThrow(/hours_replaced_per_week must be ≥ 0/);
  });

  it("update rejects customization_pct > 100 (P16 bounds)", async () => {
    const t = setup();
    const { jerry, customer } = await seed(t);
    const { id: eng } = await t.mutation(api.engagements.create, {
      customer_id: customer,
      fde_ids: [jerry],
      start_date: "2026-05-11",
      expected_end_date: "2026-06-15",
      phase: "build",
      progress_pct: 0,
      weekly_hours: 20,
      health: "green",
      notes: "",
      actor_fde_id: jerry,
    });
    const dep = await t.mutation(api.deployments.create, {
      customer_id: customer,
      engagement_id: eng,
      template_id: null,
      agent_name: "good",
      deployed_at: "2026-05-11",
      hours_replaced_per_week: 4,
      customization_pct: 0,
    });
    await expect(
      t.mutation(api.deployments.update, {
        id: dep,
        patch: { customization_pct: 250 },
      }),
    ).rejects.toThrow(/customization_pct must be 0–100/);
  });
});

/* ─────────────────────── patternExtractions ─────────────────────── */

describe("patternExtractions.extract", () => {
  async function makeEngagementAndTpl(t: ReturnType<typeof setup>) {
    const { jerry, customer } = await seed(t);
    const { id: eng } = await t.mutation(api.engagements.create, {
      customer_id: customer,
      fde_ids: [jerry],
      start_date: "2026-05-11",
      expected_end_date: "2026-06-15",
      phase: "build",
      progress_pct: 0,
      weekly_hours: 20,
      health: "green",
      notes: "notes",
      actor_fde_id: jerry,
    });
    return { jerry, customer, eng };
  }

  it("extracts to an existing template", async () => {
    const t = setup();
    const { jerry, customer, eng } = await makeEngagementAndTpl(t);
    const { id: tpl } = await t.mutation(api.templates.create, {
      name: "Reusable",
      category: "Ops",
      capabilities: [],
      origin_customer_id: customer,
      authored_by_fde_id: jerry,
      actor_fde_id: jerry,
    });
    const { extraction_id: id } = await t.mutation(api.patternExtractions.extract, {
      source_engagement_id: eng,
      source_engagement_summary: "summary",
      target_template_id: tpl,
      new_template: null,
      reused_customer_ids: [],
      actor_fde_id: jerry,
    });
    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row?.extracted_into_template_id).toBe(tpl);
    expect(row?.source_engagement_summary).toBe("summary");
  });

  it("extracts via creating a NEW template inline (with capabilities)", async () => {
    const t = setup();
    const { jerry, eng } = await makeEngagementAndTpl(t);
    const { extraction_id: id } = await t.mutation(api.patternExtractions.extract, {
      source_engagement_id: eng,
      source_engagement_summary: "summary",
      target_template_id: null,
      new_template: {
        name: "Brand New",
        category: "BD",
        capabilities: ["alpha", "beta"],
        authored_by_fde_id: jerry,
      },
      reused_customer_ids: [],
      actor_fde_id: jerry,
    });
    const ext = await t.run((ctx) => ctx.db.get(id));
    const tpl = await t.run((ctx) =>
      ctx.db.get(ext!.extracted_into_template_id),
    );
    expect(tpl?.name).toBe("Brand New");
    const caps = await t.query(api.templates.listCapabilities, {
      template_id: ext!.extracted_into_template_id,
    });
    expect(caps).toHaveLength(2);
  });

  it("addReusedCustomer dedupes via by_extraction_customer", async () => {
    const t = setup();
    const { jerry, customer, eng } = await makeEngagementAndTpl(t);
    const { id: tpl } = await t.mutation(api.templates.create, {
      name: "T",
      category: "Ops",
      capabilities: [],
      origin_customer_id: customer,
      authored_by_fde_id: jerry,
      actor_fde_id: jerry,
    });
    const { extraction_id: extraction } = await t.mutation(api.patternExtractions.extract, {
      source_engagement_id: eng,
      source_engagement_summary: "summary",
      target_template_id: tpl,
      new_template: null,
      reused_customer_ids: [],
      actor_fde_id: jerry,
    });
    const { id: other } = await t.mutation(api.customers.create, {
      name: "Other Customer",
      backed_by: [],
      start_date: "2026-05-11",
      status: "active",
      current_mrr: 0,
      is_pe: false,
      health: "green",
      actor_fde_id: null,
    });
    await t.mutation(api.patternExtractions.addReusedCustomer, {
      extraction_id: extraction,
      customer_id: other,
    });
    // Add the same one again — should no-op (dedupe)
    await t.mutation(api.patternExtractions.addReusedCustomer, {
      extraction_id: extraction,
      customer_id: other,
    });
    const reuses = await t.run((ctx) =>
      ctx.db.query("pattern_extraction_reuses").collect(),
    );
    expect(reuses).toHaveLength(1);
  });
});

/* ─────────────────────── founderHours ─────────────────────── */

describe("founderHours.upsertMonth", () => {
  it("inserts a new row when month is fresh", async () => {
    const t = setup();
    await t.mutation(api.founderHours.upsertMonth, {
      month: "2026-05",
      founder_hours_total: 320,
      new_arr_dollars: 16000,
    });
    const rows = await t.query(api.founderHours.list, {});
    expect(rows).toHaveLength(1);
    expect(rows[0].founder_hours_total).toBe(320);
  });

  it("patches the existing row when month repeats (single-row-per-month invariant)", async () => {
    const t = setup();
    await t.mutation(api.founderHours.upsertMonth, {
      month: "2026-05",
      founder_hours_total: 100,
      new_arr_dollars: 1000,
    });
    await t.mutation(api.founderHours.upsertMonth, {
      month: "2026-05",
      founder_hours_total: 320,
      new_arr_dollars: 16000,
    });
    const rows = await t.query(api.founderHours.list, {});
    expect(rows).toHaveLength(1);
    expect(rows[0].founder_hours_total).toBe(320);
    expect(rows[0].new_arr_dollars).toBe(16000);
  });
});
