/**
 * Multi-mutation integration tests. Unit tests prove each mutation works
 * in isolation; these chain them together to catch invariant breakages
 * that only surface when state accumulates.
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
  // Operator-gated mutations call assertOperator → isOperator, which reads
  // ctx.auth.getUserIdentity(). Bind a rescue-allowlisted identity (the
  // admin-auth path: email present, no sessionId) so the harness clears the
  // operator gate. "*@42nights.dev" is a hardcoded RESCUE_PATTERN.
  return convexTest(schema, modules).withIdentity({ email: "ci@42nights.dev" });
}

async function bootstrap(t: ReturnType<typeof setup>) {
  return t.run(async (ctx) => {
    const now = "2026-05-11T12:00:00.000Z";
    const jerry = await ctx.db.insert("fdes", {
      name: "Jerry",
      role: "Founder",
      is_founder: true,
      start_date: "2026-04-01",
      hours_this_week: 0,
      capacity_hours_per_week: 45,
      agents_shipped_total: 0,
      templates_authored: 0,
      slug: "jerry",
      created_at: now,
      updated_at: now,
      updated_by_fde_id: null,
    });
    const ayaan = await ctx.db.insert("fdes", {
      name: "Ayaan",
      role: "Founder",
      is_founder: true,
      start_date: "2026-04-01",
      hours_this_week: 0,
      capacity_hours_per_week: 45,
      agents_shipped_total: 0,
      templates_authored: 0,
      slug: "ayaan",
      created_at: now,
      updated_at: now,
      updated_by_fde_id: null,
    });
    return { jerry, ayaan };
  });
}

describe("engagement lifecycle (create → edit → extract → delete)", () => {
  it("preserves invariants through a full lifecycle", async () => {
    const t = setup();
    const { jerry, ayaan } = await bootstrap(t);

    // 1. Operator creates a customer.
    const { id: customer } = await t.mutation(api.customers.create, {
      name: "Acme Inc",
      backed_by: ["a16z"],
      start_date: "2026-05-11",
      status: "active",
      current_mrr: 2_500,
      is_pe: false,
      health: "green",
      actor_fde_id: jerry,
    });

    // 2. Spins up an engagement, assigns Jerry.
    const { id: eng } = await t.mutation(api.engagements.create, {
      customer_id: customer,
      fde_ids: [jerry],
      start_date: "2026-05-11",
      expected_end_date: "2026-06-30",
      phase: "discovery",
      progress_pct: 10,
      weekly_hours: 12,
      health: "green",
      notes: "Kickoff this week",
      actor_fde_id: jerry,
    });

    // 3. Move through the phases. setProgress + setHealth + markTouched.
    await t.mutation(api.engagements.movePhase, {
      id: eng,
      actor_fde_id: jerry,
      phase: "build",
    });
    await t.mutation(api.engagements.setProgress, {
      id: eng,
      actor_fde_id: jerry,
      pct: 60,
    });
    await t.mutation(api.engagements.setHealth, {
      id: eng,
      actor_fde_id: jerry,
      health: "yellow",
    });
    await t.mutation(api.engagements.markTouched, {
      id: eng,
      actor_fde_id: jerry,
    });

    // 4. Reassign to add Ayaan.
    await t.mutation(api.engagements.reassign, {
      id: eng,
      actor_fde_id: jerry,
      fde_ids: [jerry, ayaan],
    });

    // 5. Deploy an agent under it.
    const dep = await t.mutation(api.deployments.create, {
      customer_id: customer,
      engagement_id: eng,
      template_id: null,
      agent_name: "Custom Agent v1",
      deployed_at: "2026-05-25",
      hours_replaced_per_week: 6,
      customization_pct: 100,
    });

    // 6. Extract a pattern → creates new template inline.
    const { extraction_id: extraction } = await t.mutation(api.patternExtractions.extract, {
      source_engagement_id: eng,
      source_engagement_summary: "What we built for Acme",
      target_template_id: null,
      new_template: {
        name: "Acme Pattern",
        category: "Ops",
        capabilities: ["auto-quote", "approval routing"],
        authored_by_fde_id: jerry,
      },
      reused_customer_ids: [],
      actor_fde_id: jerry,
    });

    // 7. State checkpoint. Verify everything is coherent.
    const checkpoint = await t.run(async (ctx) => ({
      eng: await ctx.db.get(eng),
      assignments: await ctx.db
        .query("engagement_assignments")
        .withIndex("by_engagement", (q) =>
          q.eq("engagement_id", eng).eq("removed_at", null),
        )
        .collect(),
      deployment: await ctx.db.get(dep),
      extraction: await ctx.db.get(extraction),
      logEntries: await ctx.db
        .query("engagement_updates")
        .withIndex("by_engagement", (q) => q.eq("engagement_id", eng))
        .collect(),
    }));
    expect(checkpoint.eng?.phase).toBe("build");
    expect(checkpoint.eng?.progress_pct).toBe(60);
    expect(checkpoint.eng?.health).toBe("yellow");
    expect(checkpoint.assignments).toHaveLength(2);
    expect(checkpoint.deployment?.agent_name).toBe("Custom Agent v1");
    expect(checkpoint.extraction?.source_engagement_summary).toBe(
      "What we built for Acme",
    );
    // create + phase_change + progress + health + touched + reassign
    expect(checkpoint.logEntries.length).toBeGreaterThanOrEqual(6);

    // 8. Delete the engagement. Cascade should clear assignments,
    // deployment, extraction, reuses — but the template the extraction
    // created stays (it's now its own first-class entity).
    await t.mutation(api.engagements.remove, {
      id: eng,
      actor_fde_id: jerry,
    });

    const after = await t.run(async (ctx) => ({
      eng: await ctx.db.get(eng),
      assignments: await ctx.db
        .query("engagement_assignments")
        .collect(),
      deployments: await ctx.db.query("deployments").collect(),
      extractions: await ctx.db.query("pattern_extractions").collect(),
      reuses: await ctx.db.query("pattern_extraction_reuses").collect(),
      templates: await ctx.db.query("templates").collect(),
    }));
    expect(after.eng).toBeNull();
    expect(after.assignments).toHaveLength(0);
    expect(after.deployments).toHaveLength(0);
    expect(after.extractions).toHaveLength(0);
    expect(after.reuses).toHaveLength(0);
    // The created template survives.
    expect(after.templates).toHaveLength(1);
    expect(after.templates[0].name).toBe("Acme Pattern");
  });

  it("multi-tab notes editing: client A saves, client B's stale write rejects", async () => {
    const t = setup();
    const { jerry, ayaan } = await bootstrap(t);
    const { id: customer } = await t.mutation(api.customers.create, {
      name: "C",
      backed_by: [],
      start_date: "2026-05-11",
      status: "active",
      current_mrr: 0,
      is_pe: false,
      health: "green",
      actor_fde_id: jerry,
    });
    const { id: eng } = await t.mutation(api.engagements.create, {
      customer_id: customer,
      fde_ids: [jerry],
      start_date: "2026-05-11",
      expected_end_date: "2026-06-30",
      phase: "build",
      progress_pct: 0,
      weekly_hours: 10,
      health: "green",
      notes: "v1",
      actor_fde_id: jerry,
    });

    // Both clients fetched at version 1.
    // Client A saves first → version bumps to 2.
    const a = await t.mutation(api.engagements.saveNotes, {
      id: eng,
      actor_fde_id: jerry,
      body: "client A's draft",
      base_version: 1,
      client_id: "client-A",
    });
    expect(a?.version).toBe(2);

    // Client B (still on base_version 1) tries to save → STALE.
    await expect(
      t.mutation(api.engagements.saveNotes, {
        id: eng,
        actor_fde_id: ayaan,
        body: "client B's draft",
        base_version: 1,
        client_id: "client-B",
      }),
    ).rejects.toThrow(/STALE_BASE_VERSION/);

    // Server state still has Client A's text.
    const final = await t.run((ctx) => ctx.db.get(eng));
    expect(final?.notes_current).toBe("client A's draft");
    expect(final?.notes_version).toBe(2);
  });

  it("FDE workload reflects assignments accurately end-to-end", async () => {
    const t = setup();
    const { jerry, ayaan } = await bootstrap(t);
    const { id: customer } = await t.mutation(api.customers.create, {
      name: "C",
      backed_by: [],
      start_date: "2026-05-11",
      status: "active",
      current_mrr: 0,
      is_pe: false,
      health: "green",
      actor_fde_id: jerry,
    });

    // Two engagements, both 40h/wk total, jerry on both, ayaan on one.
    const { id: eng1 } = await t.mutation(api.engagements.create, {
      customer_id: customer,
      fde_ids: [jerry, ayaan],
      start_date: "2026-05-11",
      expected_end_date: "2026-06-30",
      phase: "build",
      progress_pct: 0,
      weekly_hours: 40,
      health: "green",
      notes: "",
      actor_fde_id: jerry,
    });
    const { id: eng2 } = await t.mutation(api.engagements.create, {
      customer_id: customer,
      fde_ids: [jerry],
      start_date: "2026-05-11",
      expected_end_date: "2026-06-30",
      phase: "build",
      progress_pct: 0,
      weekly_hours: 40,
      health: "green",
      notes: "",
      actor_fde_id: jerry,
    });
    void eng1;
    void eng2;

    const overview = await t.query(api.dashboard.overview, {});
    // Jerry: 40/2 (shared with ayaan) + 40 = 60h committed.
    // Capacity 45 → overcommitted.
    const jerryAssignments = overview.assignments.filter(
      (a) => a.fde_id === jerry && a.removed_at === null,
    );
    expect(jerryAssignments).toHaveLength(2);
    const ayaanAssignments = overview.assignments.filter(
      (a) => a.fde_id === ayaan && a.removed_at === null,
    );
    expect(ayaanAssignments).toHaveLength(1);
  });
});
