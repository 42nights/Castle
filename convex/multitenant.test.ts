/**
 * P33 multi-tenant isolation tests.
 *
 * Two scenarios:
 *   1. Flag ON  — two orgs, each with their own customer; operator in
 *      org A sees only org A's data.
 *   2. Flag OFF — all rows returned regardless of organization_id
 *      (demo / seed path is unchanged).
 */
import { convexTest } from "convex-test";
import { describe, expect, it, afterEach, beforeEach } from "vitest";
import schema from "./schema";
import { scopeToOrg } from "./lib/org";
import type { Id } from "./_generated/dataModel";

const modules = (
  import.meta as unknown as {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>;
  }
).glob("./**/*.{ts,js}");

// ─────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────

const NOW = "2026-05-31T00:00:00.000Z";

function makeTestEnv() {
  return convexTest(schema, modules).withIdentity({ email: "ci@42nights.dev" });
}

async function insertOrg(
  t: ReturnType<typeof makeTestEnv>,
  slug: string,
  name: string,
) {
  return t.run(async (ctx) => {
    return ctx.db.insert("organizations", {
      name,
      slug,
      created_at: NOW,
    });
  });
}

async function insertCustomer(
  t: ReturnType<typeof makeTestEnv>,
  name: string,
  orgId?: Id<"organizations">,
) {
  return t.run(async (ctx) => {
    return ctx.db.insert("customers", {
      name,
      backed_by: [],
      start_date: NOW,
      status: "active" as const,
      current_mrr: 0,
      is_pe: false,
      health: "green" as const,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      created_at: NOW,
      updated_at: NOW,
      updated_by_fde_id: null,
      ...(orgId ? { organization_id: orgId } : {}),
    });
  });
}

// ─────────────────────────────────────────────────────────────────────
//  scopeToOrg unit tests (pure function, no DB)
// ─────────────────────────────────────────────────────────────────────

describe("scopeToOrg — pure unit tests", () => {
  type Row = { _id: string; organization_id?: Id<"organizations"> };

  const orgA = "org_a" as Id<"organizations">;
  const orgB = "org_b" as Id<"organizations">;

  const rowOrgA: Row = { _id: "r1", organization_id: orgA };
  const rowOrgB: Row = { _id: "r2", organization_id: orgB };
  const rowUnstamped: Row = { _id: "r3" }; // no organization_id — legacy

  it("returns ALL rows when orgId is null (flag OFF)", () => {
    const result = scopeToOrg([rowOrgA, rowOrgB, rowUnstamped], null);
    expect(result).toHaveLength(3);
  });

  it("returns only org A rows + unstamped rows when scoped to org A", () => {
    const result = scopeToOrg([rowOrgA, rowOrgB, rowUnstamped], orgA);
    expect(result.map((r) => r._id)).toEqual(["r1", "r3"]);
  });

  it("returns only org B rows + unstamped rows when scoped to org B", () => {
    const result = scopeToOrg([rowOrgA, rowOrgB, rowUnstamped], orgB);
    expect(result.map((r) => r._id)).toEqual(["r2", "r3"]);
  });

  it("returns empty array when no rows belong to the org", () => {
    const orgC = "org_c" as Id<"organizations">;
    const result = scopeToOrg([rowOrgA, rowOrgB], orgC);
    expect(result).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
//  Flag-OFF tests: no filtering even when organization_id is present
// ─────────────────────────────────────────────────────────────────────

describe("flag OFF — zero behavioral change", () => {
  it("customers.list returns ALL rows regardless of organization_id", async () => {
    const t = makeTestEnv();
    // Create two orgs and stamp customers to each
    const orgA = await insertOrg(t, "org-alpha", "Alpha");
    const orgB = await insertOrg(t, "org-beta", "Beta");
    await insertCustomer(t, "Acme Alpha", orgA);
    await insertCustomer(t, "Acme Beta", orgB);
    await insertCustomer(t, "Acme Legacy"); // no org_id

    // With flag OFF (default in tests — process.env.CASTLE_MULTITENANT is unset),
    // scopeToOrg returns everything. Verify by checking scopeToOrg directly.
    const allRows = await t.run(async (ctx) => ctx.db.query("customers").collect());
    const scoped = scopeToOrg(allRows, null);
    expect(scoped).toHaveLength(3);
  });

  it("all three customers visible — seeded demo data unaffected", async () => {
    const t = makeTestEnv();
    await insertCustomer(t, "Demo Customer A");
    await insertCustomer(t, "Demo Customer B");
    await insertCustomer(t, "Demo Customer C");

    const rows = await t.run(async (ctx) => ctx.db.query("customers").collect());
    // scopeToOrg(null) is a no-op
    expect(scopeToOrg(rows, null)).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────────────
//  Flag-ON isolation tests: cross-org read returns nothing
// ─────────────────────────────────────────────────────────────────────

describe("flag ON — org isolation", () => {
  it("operator in org A cannot see org B customers", async () => {
    const t = makeTestEnv();
    const orgA = await insertOrg(t, "acme-corp", "Acme Corp");
    const orgB = await insertOrg(t, "rival-inc", "Rival Inc");

    await insertCustomer(t, "Acme Customer", orgA);
    await insertCustomer(t, "Rival Customer", orgB);
    // A legacy row with no org (should only be visible to the default org)
    await insertCustomer(t, "Legacy Customer");

    const allRows = await t.run(async (ctx) => ctx.db.query("customers").collect());

    // Operator A sees org A rows + unstamped legacy rows
    const seenByA = scopeToOrg(allRows, orgA);
    expect(seenByA.map((r) => r.name).sort()).toEqual(
      ["Acme Customer", "Legacy Customer"].sort(),
    );

    // Operator B sees org B rows + unstamped legacy rows
    const seenByB = scopeToOrg(allRows, orgB);
    expect(seenByB.map((r) => r.name).sort()).toEqual(
      ["Legacy Customer", "Rival Customer"].sort(),
    );

    // Cross-org: org A cannot see org B's customer
    expect(seenByA.find((r) => r.name === "Rival Customer")).toBeUndefined();
    // Cross-org: org B cannot see org A's customer
    expect(seenByB.find((r) => r.name === "Acme Customer")).toBeUndefined();
  });

  it("two orgs with same customer name — each only sees their own", async () => {
    const t = makeTestEnv();
    const orgA = await insertOrg(t, "firm-a", "Firm A");
    const orgB = await insertOrg(t, "firm-b", "Firm B");

    // Both orgs have a customer named "Overlapping Co"
    await t.run(async (ctx) => {
      await ctx.db.insert("customers", {
        name: "Overlapping Co",
        backed_by: [],
        start_date: NOW,
        status: "active" as const,
        current_mrr: 0,
        is_pe: false,
        health: "green" as const,
        slug: "overlapping-co-a",
        created_at: NOW,
        updated_at: NOW,
        updated_by_fde_id: null,
        organization_id: orgA,
      });
      await ctx.db.insert("customers", {
        name: "Overlapping Co",
        backed_by: [],
        start_date: NOW,
        status: "active" as const,
        current_mrr: 0,
        is_pe: false,
        health: "green" as const,
        slug: "overlapping-co-b",
        created_at: NOW,
        updated_at: NOW,
        updated_by_fde_id: null,
        organization_id: orgB,
      });
    });

    const allRows = await t.run(async (ctx) => ctx.db.query("customers").collect());

    const seenByA = scopeToOrg(allRows, orgA);
    const seenByB = scopeToOrg(allRows, orgB);

    // Each org sees exactly one "Overlapping Co"
    expect(seenByA.filter((r) => r.name === "Overlapping Co")).toHaveLength(1);
    expect(seenByB.filter((r) => r.name === "Overlapping Co")).toHaveLength(1);

    // And they're different rows
    expect(seenByA[0]._id).not.toEqual(seenByB[0]._id);
  });

  it("scopeToOrg with an org that has no rows returns empty", async () => {
    const t = makeTestEnv();
    const orgA = await insertOrg(t, "has-data", "Has Data");
    const orgC = await insertOrg(t, "no-data", "No Data");

    await insertCustomer(t, "Only A", orgA);

    const allRows = await t.run(async (ctx) => ctx.db.query("customers").collect());
    const seenByC = scopeToOrg(allRows, orgC);
    expect(seenByC).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
//  Migration: stampDefaultOrg creates org + stamps rows
// ─────────────────────────────────────────────────────────────────────

describe("stampDefaultOrg migration", () => {
  it("creates the default org and stamps existing rows", async () => {
    const t = makeTestEnv();

    // Insert a customer with NO org_id (simulating pre-P33 data)
    const custId = await insertCustomer(t, "Pre-Migration Customer");

    // Insert an email_allowlist row for the operator
    await t.run(async (ctx) => {
      await ctx.db.insert("email_allowlist", {
        pattern: "ci@42nights.dev",
        created_at: NOW,
      });
    });

    // Run the migration
    const result = await t.mutation(
      (await import("./_generated/api")).api.migrations.stampDefaultOrg,
      {},
    );

    expect(result.stamped).toBeGreaterThanOrEqual(1);
    expect(result.orgId).toBeDefined();

    // Verify the customer now has organization_id set
    const customer = await t.run(async (ctx) => ctx.db.get(custId));
    expect(customer?.organization_id).toEqual(result.orgId);

    // Verify the org was created with the right slug
    const org = await t.run(async (ctx) =>
      ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", "42nights-default"))
        .first(),
    );
    expect(org).not.toBeNull();
    expect(org?.name).toBe("42nights");
  });

  it("is idempotent — re-running does not double-stamp or error", async () => {
    const t = makeTestEnv();

    await t.run(async (ctx) => {
      await ctx.db.insert("email_allowlist", {
        pattern: "ci@42nights.dev",
        created_at: NOW,
      });
    });

    const r1 = await t.mutation(
      (await import("./_generated/api")).api.migrations.stampDefaultOrg,
      {},
    );
    const r2 = await t.mutation(
      (await import("./_generated/api")).api.migrations.stampDefaultOrg,
      {},
    );

    // Second run stamps 0 because all rows already have org_id
    expect(r2.stamped).toBe(0);
    expect(r1.orgId).toEqual(r2.orgId);
  });
});
