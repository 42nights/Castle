import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

// Vite glob is how convex-test wires schema/file modules; only matters under
// vitest. Cast around tsc's stricter ImportMeta type since vite/client types
// aren't referenced here (vitest provides them at runtime).
const modules = (
  import.meta as unknown as {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>;
  }
).glob("./**/*.{ts,js}");

function setup() {
  return convexTest(schema, modules);
}

async function seedBaseEntities(t: ReturnType<typeof setup>) {
  // We populate directly via ctx.db.insert (faster + lets us bypass the
  // create-mutation validators where we're testing OTHER mutations).
  return t.run(async (ctx) => {
    const now = new Date().toISOString();
    const fde = await ctx.db.insert("fdes", {
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
    const customer = await ctx.db.insert("customers", {
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
    return { fde, ayaan, customer };
  });
}

/* ─────────────────────── bounds (P16) ─────────────────────── */

describe("bounds enforcement", () => {
  it("rejects negative current_mrr in customers.create", async () => {
    const t = setup();
    await expect(
      t.mutation(api.customers.create, {
        name: "Bad",
        backed_by: [],
        start_date: "2026-05-11",
        status: "active",
        current_mrr: -50,
        is_pe: false,
        health: "green",
        actor_fde_id: null,
      }),
    ).rejects.toThrow(/current_mrr must be ≥ 0/);
  });

  it("rejects progress_pct > 100 in engagements.create", async () => {
    const t = setup();
    const { fde, customer } = await seedBaseEntities(t);
    await expect(
      t.mutation(api.engagements.create, {
        customer_id: customer,
        fde_ids: [fde],
        start_date: "2026-05-11",
        expected_end_date: "2026-06-15",
        phase: "build",
        progress_pct: 150,
        weekly_hours: 20,
        health: "green",
        notes: "",
        actor_fde_id: fde,
      }),
    ).rejects.toThrow(/progress_pct must be 0–100/);
  });

  it("rejects negative weekly_hours in engagements.update", async () => {
    const t = setup();
    const { fde, customer } = await seedBaseEntities(t);
    const { id: eng } = await t.mutation(api.engagements.create, {
      customer_id: customer,
      fde_ids: [fde],
      start_date: "2026-05-11",
      expected_end_date: "2026-06-15",
      phase: "build",
      progress_pct: 50,
      weekly_hours: 20,
      health: "green",
      notes: "",
      actor_fde_id: fde,
    });
    await expect(
      t.mutation(api.engagements.update, {
        id: eng,
        patch: { weekly_hours: -5 },
        actor_fde_id: fde,
      }),
    ).rejects.toThrow(/weekly_hours must be ≥ 0/);
  });

  it("rejects negative capacity in fdes.setCapacity", async () => {
    const t = setup();
    const { fde } = await seedBaseEntities(t);
    await expect(
      t.mutation(api.fdes.setCapacity, {
        id: fde,
        capacity_hours_per_week: -10,
        actor_fde_id: null,
      }),
    ).rejects.toThrow(/capacity must be non-negative/);
  });
});

/* ─────────────────────── support invariant (P13) ─────────────────────── */

describe("support phase progress invariant", () => {
  it("create with phase=support pins progress to 100 regardless of input", async () => {
    const t = setup();
    const { fde, customer } = await seedBaseEntities(t);
    const { id: eng } = await t.mutation(api.engagements.create, {
      customer_id: customer,
      fde_ids: [fde],
      start_date: "2026-05-11",
      expected_end_date: "2026-06-15",
      phase: "support",
      progress_pct: 42,
      weekly_hours: 4,
      health: "green",
      notes: "",
      actor_fde_id: fde,
    });
    const row = await t.run(async (ctx) => ctx.db.get(eng));
    expect(row?.progress_pct).toBe(100);
  });

  it("movePhase to support pins progress to 100", async () => {
    const t = setup();
    const { fde, customer } = await seedBaseEntities(t);
    const { id: eng } = await t.mutation(api.engagements.create, {
      customer_id: customer,
      fde_ids: [fde],
      start_date: "2026-05-11",
      expected_end_date: "2026-06-15",
      phase: "deployed",
      progress_pct: 60,
      weekly_hours: 4,
      health: "green",
      notes: "",
      actor_fde_id: fde,
    });
    await t.mutation(api.engagements.movePhase, {
      id: eng,
      actor_fde_id: fde,
      phase: "support",
    });
    const row = await t.run(async (ctx) => ctx.db.get(eng));
    expect(row?.progress_pct).toBe(100);
    expect(row?.phase).toBe("support");
  });

  it("setProgress rejects on support-phase engagements", async () => {
    const t = setup();
    const { fde, customer } = await seedBaseEntities(t);
    const { id: eng } = await t.mutation(api.engagements.create, {
      customer_id: customer,
      fde_ids: [fde],
      start_date: "2026-05-11",
      expected_end_date: "2026-06-15",
      phase: "support",
      progress_pct: 100,
      weekly_hours: 4,
      health: "green",
      notes: "",
      actor_fde_id: fde,
    });
    await expect(
      t.mutation(api.engagements.setProgress, {
        id: eng,
        actor_fde_id: fde,
        pct: 60,
      }),
    ).rejects.toThrow(/support phase/);
  });
});

/* ─────────────────────── reassign dedupe + resurrect (P13) ─────────────────────── */

describe("reassign", () => {
  it("dedupes a duplicate input — won't create two active rows for same FDE", async () => {
    const t = setup();
    const { fde, customer } = await seedBaseEntities(t);
    const { id: eng } = await t.mutation(api.engagements.create, {
      customer_id: customer,
      fde_ids: [],
      start_date: "2026-05-11",
      expected_end_date: "2026-06-15",
      phase: "build",
      progress_pct: 0,
      weekly_hours: 20,
      health: "green",
      notes: "",
      actor_fde_id: fde,
    });
    await t.mutation(api.engagements.reassign, {
      id: eng,
      actor_fde_id: fde,
      fde_ids: [fde, fde, fde], // dup ×3 → 1 row
    });
    const active = await t.query(api.engagements.listAssignments, {
      engagement_id: eng,
    });
    const live = active.filter((a) => a.removed_at === null);
    expect(live).toHaveLength(1);
  });

  it("resurrects a ghost row when re-adding a previously-removed FDE", async () => {
    const t = setup();
    const { fde, ayaan, customer } = await seedBaseEntities(t);
    const { id: eng } = await t.mutation(api.engagements.create, {
      customer_id: customer,
      fde_ids: [fde],
      start_date: "2026-05-11",
      expected_end_date: "2026-06-15",
      phase: "build",
      progress_pct: 0,
      weekly_hours: 20,
      health: "green",
      notes: "",
      actor_fde_id: fde,
    });
    // Drop everyone
    await t.mutation(api.engagements.reassign, {
      id: eng,
      actor_fde_id: ayaan,
      fde_ids: [],
    });
    let rows = await t.query(api.engagements.listAssignments, {
      engagement_id: eng,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].removed_at).not.toBeNull();
    // Re-add Jerry — should reuse the same row, not insert a new one
    await t.mutation(api.engagements.reassign, {
      id: eng,
      actor_fde_id: ayaan,
      fde_ids: [fde],
    });
    rows = await t.query(api.engagements.listAssignments, {
      engagement_id: eng,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].removed_at).toBeNull();
  });
});

/* ─────────────────────── saveNotes versioning (P13 + P16) ─────────────────────── */

describe("saveNotes", () => {
  async function makeEngagement(t: ReturnType<typeof setup>) {
    const { fde, customer } = await seedBaseEntities(t);
    const { id: eng } = await t.mutation(api.engagements.create, {
      customer_id: customer,
      fde_ids: [fde],
      start_date: "2026-05-11",
      expected_end_date: "2026-06-15",
      phase: "build",
      progress_pct: 0,
      weekly_hours: 20,
      health: "green",
      notes: "initial",
      actor_fde_id: fde,
    });
    return { fde, eng };
  }

  it("bumps notes_version on accepted write", async () => {
    const t = setup();
    const { fde, eng } = await makeEngagement(t);
    const res = await t.mutation(api.engagements.saveNotes, {
      id: eng,
      actor_fde_id: fde,
      body: "v2 body",
      base_version: 1,
      client_id: "client-1",
    });
    expect(res?.version).toBe(2);
  });

  it("rejects STALE_BASE_VERSION when base_version < server", async () => {
    const t = setup();
    const { fde, eng } = await makeEngagement(t);
    await t.mutation(api.engagements.saveNotes, {
      id: eng,
      actor_fde_id: fde,
      body: "v2",
      base_version: 1,
      client_id: "client-1",
    });
    await expect(
      t.mutation(api.engagements.saveNotes, {
        id: eng,
        actor_fde_id: fde,
        body: "stale",
        base_version: 1, // server is at 2 now
        client_id: "client-1",
      }),
    ).rejects.toThrow(/STALE_BASE_VERSION/);
  });

  it("rejects INVALID_BASE_VERSION when client is ahead (P16)", async () => {
    const t = setup();
    const { fde, eng } = await makeEngagement(t);
    await expect(
      t.mutation(api.engagements.saveNotes, {
        id: eng,
        actor_fde_id: fde,
        body: "x",
        base_version: 999,
        client_id: "c",
      }),
    ).rejects.toThrow(/INVALID_BASE_VERSION/);
  });

  it("rejects fractional/negative base_version (P16)", async () => {
    const t = setup();
    const { fde, eng } = await makeEngagement(t);
    await expect(
      t.mutation(api.engagements.saveNotes, {
        id: eng,
        actor_fde_id: fde,
        body: "x",
        base_version: -1,
        client_id: "c",
      }),
    ).rejects.toThrow(/positive integer/);
  });
});

/* ─────────────────────── delete cascade (P16) ─────────────────────── */

describe("engagement delete cascade", () => {
  it("removes assignments + deployments + extractions + reuses", async () => {
    const t = setup();
    const { fde, customer } = await seedBaseEntities(t);
    const { id: eng } = await t.mutation(api.engagements.create, {
      customer_id: customer,
      fde_ids: [fde],
      start_date: "2026-05-11",
      expected_end_date: "2026-06-15",
      phase: "build",
      progress_pct: 0,
      weekly_hours: 20,
      health: "green",
      notes: "",
      actor_fde_id: fde,
    });
    const { id: tpl } = await t.mutation(api.templates.create, {
      name: "Test Template",
      category: "Ops",
      capabilities: ["a"],
      origin_customer_id: customer,
      authored_by_fde_id: fde,
      actor_fde_id: fde,
    });
    await t.mutation(api.deployments.create, {
      customer_id: customer,
      engagement_id: eng,
      template_id: tpl,
      agent_name: "agent",
      deployed_at: "2026-05-11",
      hours_replaced_per_week: 4,
      customization_pct: 0,
    });
    await t.mutation(api.patternExtractions.extract, {
      source_engagement_id: eng,
      source_engagement_summary: "summary",
      target_template_id: tpl,
      new_template: null,
      reused_customer_ids: [customer],
      actor_fde_id: fde,
    });

    // Counts BEFORE
    const before = await t.run(async (ctx) => ({
      assignments: (await ctx.db.query("engagement_assignments").collect())
        .length,
      deployments: (await ctx.db.query("deployments").collect()).length,
      extractions: (await ctx.db.query("pattern_extractions").collect()).length,
      reuses: (await ctx.db.query("pattern_extraction_reuses").collect())
        .length,
    }));
    expect(before).toEqual({
      assignments: 1,
      deployments: 1,
      extractions: 1,
      reuses: 1,
    });

    await t.mutation(api.engagements.remove, {
      id: eng,
      actor_fde_id: fde,
    });

    const after = await t.run(async (ctx) => ({
      assignments: (await ctx.db.query("engagement_assignments").collect())
        .length,
      deployments: (await ctx.db.query("deployments").collect()).length,
      extractions: (await ctx.db.query("pattern_extractions").collect()).length,
      reuses: (await ctx.db.query("pattern_extraction_reuses").collect())
        .length,
      engagement: await ctx.db.get(eng as Id<"engagements">),
    }));
    expect(after.assignments).toBe(0);
    expect(after.deployments).toBe(0);
    expect(after.extractions).toBe(0);
    expect(after.reuses).toBe(0);
    expect(after.engagement).toBeNull();
  });
});

/* ─────────────────────── slug uniqueness ─────────────────────── */

describe("slug uniqueness", () => {
  it("appends -2 on collision in customers.create", async () => {
    const t = setup();
    const { id: a } = await t.mutation(api.customers.create, {
      name: "Test Customer",
      backed_by: [],
      start_date: "2026-05-11",
      status: "active",
      current_mrr: 0,
      is_pe: false,
      health: "green",
      actor_fde_id: null,
    });
    const { id: b } = await t.mutation(api.customers.create, {
      name: "Test Customer",
      backed_by: [],
      start_date: "2026-05-11",
      status: "active",
      current_mrr: 0,
      is_pe: false,
      health: "green",
      actor_fde_id: null,
    });
    const docs = await t.run(async (ctx) => ({
      a: await ctx.db.get(a),
      b: await ctx.db.get(b),
    }));
    expect(docs.a?.slug).toBe("test-customer");
    expect(docs.b?.slug).toBe("test-customer-2");
  });
});

/* ─────────────────────── capability swap atomic (P14) ─────────────────────── */

describe("capability swap is atomic", () => {
  it("swaps positions of two capabilities on the same template", async () => {
    const t = setup();
    const { fde, customer } = await seedBaseEntities(t);
    const { id: tpl } = await t.mutation(api.templates.create, {
      name: "T",
      category: "Ops",
      capabilities: ["first", "second", "third"],
      origin_customer_id: customer,
      authored_by_fde_id: fde,
      actor_fde_id: fde,
    });
    const caps = await t.query(api.templates.listCapabilities, {
      template_id: tpl,
    });
    const a = caps.find((c) => c.body === "first")!;
    const c = caps.find((c) => c.body === "third")!;
    await t.mutation(api.templates.swapCapabilityPositions, {
      a_id: a._id,
      b_id: c._id,
      actor_fde_id: fde,
    });
    const after = await t.query(api.templates.listCapabilities, {
      template_id: tpl,
    });
    expect(after.find((c) => c.body === "first")?.position).toBe(c.position);
    expect(after.find((c) => c.body === "third")?.position).toBe(a.position);
  });

  it("rejects swap across templates", async () => {
    const t = setup();
    const { fde, customer } = await seedBaseEntities(t);
    const { id: t1 } = await t.mutation(api.templates.create, {
      name: "T1",
      category: "Ops",
      capabilities: ["a"],
      origin_customer_id: customer,
      authored_by_fde_id: fde,
      actor_fde_id: fde,
    });
    const { id: t2 } = await t.mutation(api.templates.create, {
      name: "T2",
      category: "Ops",
      capabilities: ["b"],
      origin_customer_id: customer,
      authored_by_fde_id: fde,
      actor_fde_id: fde,
    });
    const caps1 = await t.query(api.templates.listCapabilities, {
      template_id: t1,
    });
    const caps2 = await t.query(api.templates.listCapabilities, {
      template_id: t2,
    });
    await expect(
      t.mutation(api.templates.swapCapabilityPositions, {
        a_id: caps1[0]._id,
        b_id: caps2[0]._id,
        actor_fde_id: fde,
      }),
    ).rejects.toThrow(/across templates/);
  });
});
