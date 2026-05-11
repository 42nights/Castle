import { describe, expect, it } from "vitest";
import { adaptOverview, type ConvexOverview } from "./adapters";

/**
 * Convex docs in tests are minimal handcrafted blobs (TypeScript will
 * complain about extra fields it doesn't know about, but the adapter only
 * reads documented fields).
 */
function snapshot(overrides: Partial<ConvexOverview> = {}): ConvexOverview {
  return {
    fdes: [],
    customers: [],
    engagements: [],
    assignments: [],
    deployments: [],
    templates: [],
    capabilities: [],
    extractions: [],
    reuses: [],
    founderHours: [],
    ...overrides,
  } as ConvexOverview;
}

describe("adaptOverview", () => {
  it("translates Convex _ids to slugs across relationships", () => {
    const out = adaptOverview(
      snapshot({
        customers: [
          {
            _id: "cust1",
            _creationTime: 0,
            name: "Customer 1",
            backed_by: [],
            start_date: "2026-01-01",
            status: "active",
            current_mrr: 1000,
            is_pe: false,
            health: "green",
            slug: "cust-1",
          },
        ],
        engagements: [
          {
            _id: "eng1",
            _creationTime: 0,
            customer_id: "cust1",
            start_date: "2026-04-01",
            expected_end_date: "2026-06-01",
            last_update_at: "2026-05-01",
            phase: "build",
            progress_pct: 50,
            weekly_hours: 20,
            health: "green",
            notes_current: "",
            notes_version: 1,
            slug: "eng-1",
          },
        ],
      }),
    );
    expect(out.engagements[0].id).toBe("eng-1");
    expect(out.engagements[0].customer_id).toBe("cust-1");
  });

  it("builds engagement.fde_ids from active assignments only", () => {
    const out = adaptOverview(
      snapshot({
        fdes: [
          {
            _id: "fdeA",
            _creationTime: 0,
            name: "A",
            role: "FDE",
            is_founder: false,
            start_date: "2026-01-01",
            hours_this_week: 0,
            capacity_hours_per_week: 40,
            agents_shipped_total: 0,
            templates_authored: 0,
            slug: "a",
          },
          {
            _id: "fdeB",
            _creationTime: 0,
            name: "B",
            role: "FDE",
            is_founder: false,
            start_date: "2026-01-01",
            hours_this_week: 0,
            capacity_hours_per_week: 40,
            agents_shipped_total: 0,
            templates_authored: 0,
            slug: "b",
          },
        ],
        engagements: [
          {
            _id: "eng1",
            _creationTime: 0,
            customer_id: "cust1",
            start_date: "2026-01-01",
            expected_end_date: "2026-06-01",
            last_update_at: "2026-01-01",
            phase: "build",
            progress_pct: 0,
            weekly_hours: 20,
            health: "green",
            notes_current: "",
            notes_version: 1,
            slug: "eng-1",
          },
        ],
        customers: [
          {
            _id: "cust1",
            _creationTime: 0,
            name: "C",
            backed_by: [],
            start_date: "2026-01-01",
            status: "active",
            current_mrr: 0,
            is_pe: false,
            health: "green",
            slug: "cust-1",
          },
        ],
        assignments: [
          {
            _id: "as1",
            _creationTime: 0,
            engagement_id: "eng1",
            fde_id: "fdeA",
            assigned_at: "2026-01-01",
            removed_at: null,
            allocation_hours: null,
          },
          {
            _id: "as2",
            _creationTime: 0,
            engagement_id: "eng1",
            fde_id: "fdeB",
            assigned_at: "2026-01-01",
            removed_at: "2026-02-01", // removed → must not appear
            allocation_hours: null,
          },
        ],
      }),
    );
    expect(out.engagements[0].fde_ids).toEqual(["a"]);
  });

  it("preserves seeded Template.created_at (was using _creationTime)", () => {
    // The P15 bug: adapter previously did `new Date(t._creationTime).toISOString()`,
    // silently overwriting the seed-preserved authored date.
    const out = adaptOverview(
      snapshot({
        customers: [
          {
            _id: "cust1",
            _creationTime: 0,
            name: "C",
            backed_by: [],
            start_date: "2026-01-01",
            status: "active",
            current_mrr: 0,
            is_pe: false,
            health: "green",
            slug: "cust-1",
          },
        ],
        fdes: [
          {
            _id: "fde1",
            _creationTime: 0,
            name: "J",
            role: "Founder",
            is_founder: true,
            start_date: "2026-01-01",
            hours_this_week: 0,
            capacity_hours_per_week: 40,
            agents_shipped_total: 0,
            templates_authored: 0,
            slug: "j",
          },
        ],
        templates: [
          {
            _id: "tpl1",
            _creationTime: 9_999_999_999, // far-future "insert time"
            name: "T",
            category: "Ops",
            origin_customer_id: "cust1",
            authored_by_fde_id: "fde1",
            slug: "t-1",
            created_at: "2026-04-18", // the date that matters
          },
        ],
      }),
    );
    expect(out.templates[0].created_at).toBe("2026-04-18");
  });

  it("orders template capabilities by position", () => {
    const out = adaptOverview(
      snapshot({
        templates: [
          {
            _id: "tpl1",
            _creationTime: 0,
            name: "T",
            category: "Ops",
            origin_customer_id: "cust1",
            authored_by_fde_id: "fde1",
            slug: "t-1",
            created_at: "2026-04-18",
          },
        ],
        capabilities: [
          { _id: "cap3", _creationTime: 0, template_id: "tpl1", body: "third", position: 3 },
          { _id: "cap1", _creationTime: 0, template_id: "tpl1", body: "first", position: 1 },
          { _id: "cap2", _creationTime: 0, template_id: "tpl1", body: "second", position: 2 },
        ],
      }),
    );
    expect(out.templates[0].capabilities).toEqual(["first", "second", "third"]);
  });

  it("NULLS out deployment.template_id when the template was deleted (was a bug)", () => {
    // P15 bug: `slugById[d.template_id] ?? d.template_id` left a raw Convex _id
    // when the template no longer existed, which downstream code counted
    // as "template-based" and rendered as broken links.
    const out = adaptOverview(
      snapshot({
        customers: [
          {
            _id: "cust1",
            _creationTime: 0,
            name: "C",
            backed_by: [],
            start_date: "2026-01-01",
            status: "active",
            current_mrr: 0,
            is_pe: false,
            health: "green",
            slug: "cust-1",
          },
        ],
        engagements: [
          {
            _id: "eng1",
            _creationTime: 0,
            customer_id: "cust1",
            start_date: "2026-01-01",
            expected_end_date: "2026-06-01",
            last_update_at: "2026-01-01",
            phase: "build",
            progress_pct: 0,
            weekly_hours: 0,
            health: "green",
            notes_current: "",
            notes_version: 1,
            slug: "eng-1",
          },
        ],
        deployments: [
          {
            _id: "dep1",
            _creationTime: 0,
            customer_id: "cust1",
            engagement_id: "eng1",
            template_id: "tpl-DELETED-DOES-NOT-EXIST",
            agent_name: "X",
            deployed_at: "2026-05-01",
            hours_replaced_per_week: 4,
            customization_pct: 0,
          },
        ],
      }),
    );
    expect(out.deployments[0].template_id).toBeNull();
  });

  it("collects reused_at_customer_ids from junction rows", () => {
    const out = adaptOverview(
      snapshot({
        customers: [
          {
            _id: "cA",
            _creationTime: 0,
            name: "A",
            backed_by: [],
            start_date: "",
            status: "active",
            current_mrr: 0,
            is_pe: false,
            health: "green",
            slug: "cust-a",
          },
          {
            _id: "cB",
            _creationTime: 0,
            name: "B",
            backed_by: [],
            start_date: "",
            status: "active",
            current_mrr: 0,
            is_pe: false,
            health: "green",
            slug: "cust-b",
          },
        ],
        engagements: [
          {
            _id: "eng1",
            _creationTime: 0,
            customer_id: "cA",
            start_date: "",
            expected_end_date: "",
            last_update_at: "",
            phase: "build",
            progress_pct: 0,
            weekly_hours: 0,
            health: "green",
            notes_current: "",
            notes_version: 1,
            slug: "eng-1",
          },
        ],
        templates: [
          {
            _id: "tpl1",
            _creationTime: 0,
            name: "",
            category: "Ops",
            origin_customer_id: "cA",
            authored_by_fde_id: "f1",
            slug: "t",
            created_at: "",
          },
        ],
        fdes: [
          {
            _id: "f1",
            _creationTime: 0,
            name: "F",
            role: "FDE",
            is_founder: false,
            start_date: "",
            hours_this_week: 0,
            capacity_hours_per_week: 0,
            agents_shipped_total: 0,
            templates_authored: 0,
            slug: "f",
          },
        ],
        extractions: [
          {
            _id: "ext1",
            _creationTime: 0,
            source_customer_id: "cA",
            source_engagement_id: "eng1",
            source_engagement_summary: "summary",
            extracted_into_template_id: "tpl1",
            extracted_at: "2026-04-01",
          },
        ],
        reuses: [
          {
            _id: "r1",
            _creationTime: 0,
            extraction_id: "ext1",
            customer_id: "cB",
            added_at: "2026-04-01",
          },
        ],
      }),
    );
    expect(out.patternExtractions[0].reused_at_customer_ids).toEqual([
      "cust-b",
    ]);
  });
});
