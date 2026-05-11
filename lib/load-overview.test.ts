/**
 * Fallback-path tests for loadOverview.
 *
 * The Convex live path is covered by the convex-test suite. Here we make
 * sure the JSON fallback fires correctly when:
 *   (a) NEXT_PUBLIC_CONVEX_URL is unset
 *   (b) it IS set but fetchQuery throws (Convex unreachable)
 *
 * Both scenarios should return v0 data, not crash. This locks in the
 * P14 codex fix that wrapped fetchQuery/preloadQuery in try/catch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

afterEach(() => {
  process.env.NEXT_PUBLIC_CONVEX_URL = ORIGINAL_URL;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("loadOverview fallback (no Convex env)", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
  });

  it("reads data/*.json when NEXT_PUBLIC_CONVEX_URL is unset", async () => {
    const mod = await import("./load-overview");
    const result = await mod.loadOverview();
    expect(result.fdes.length).toBeGreaterThan(0);
    expect(result.customers.some((c) => c.name === "Eragon")).toBe(true);
    expect(result.engagements.length).toBeGreaterThan(0);
    expect(result.convexIdBySlug).toEqual({});
  });
});

describe("loadOverview fallback (Convex unreachable)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "http://127.0.0.1:1"; // intentionally dead
  });

  it("falls back to JSON when fetchQuery throws", async () => {
    // Stub fetchQuery to simulate the unreachable backend.
    vi.doMock("convex/nextjs", () => ({
      fetchQuery: vi.fn(() => Promise.reject(new Error("fetch failed"))),
    }));

    const mod = await import("./load-overview");
    const result = await mod.loadOverview();
    // Same v0 customers as the no-env case
    expect(result.customers.some((c) => c.name === "Eragon")).toBe(true);
    expect(result.convexIdBySlug).toEqual({});
  });
});

describe("loadOverview happy path (Convex returns data)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "http://127.0.0.1:3210";
  });

  it("adapts a Convex snapshot when fetchQuery resolves", async () => {
    const snapshot = {
      fdes: [
        {
          _id: "f1",
          _creationTime: 0,
          name: "Live FDE",
          role: "Founder" as const,
          is_founder: true,
          start_date: "",
          hours_this_week: 0,
          capacity_hours_per_week: 40,
          agents_shipped_total: 0,
          templates_authored: 0,
          slug: "live-fde",
        },
      ],
      customers: [
        {
          _id: "c1",
          _creationTime: 0,
          name: "Live Customer",
          backed_by: [],
          start_date: "",
          status: "active" as const,
          current_mrr: 9999,
          is_pe: false,
          health: "green" as const,
          slug: "live-cust",
        },
      ],
      engagements: [],
      assignments: [],
      deployments: [],
      templates: [],
      capabilities: [],
      extractions: [],
      reuses: [],
      founderHours: [],
    };
    vi.doMock("convex/nextjs", () => ({
      fetchQuery: vi.fn(() => Promise.resolve(snapshot)),
    }));

    const mod = await import("./load-overview");
    const result = await mod.loadOverview();
    expect(result.customers).toHaveLength(1);
    expect(result.customers[0].name).toBe("Live Customer");
    expect(result.customers[0].current_mrr).toBe(9999);
    // convexIdBySlug populated from the snapshot
    expect(result.convexIdBySlug["live-cust"]).toBe("c1");
    expect(result.convexIdBySlug["live-fde"]).toBe("f1");
  });
});
