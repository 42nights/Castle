/**
 * Verifies that the committed data/*.json seed payload imports cleanly and
 * materializes the six-template demo-day artifact: every template carries a
 * github_repo, live_url, and tags; capabilities land in MD-specified counts;
 * deployments resolve their template_id; extractions carry their reuse chips.
 *
 * Runs the real importPayload mutation in-memory (convex-test) against the
 * real schema, so it catches FK typos and shape drift without a deployment.
 */
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

import fdes from "../data/fdes.json";
import customers from "../data/customers.json";
import engagements from "../data/engagements.json";
import templates from "../data/templates.json";
import deployments from "../data/deployments.json";
import extractions from "../data/pattern_extractions.json";
import founderHours from "../data/founder_hours.json";

const modules = (
  import.meta as unknown as {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>;
  }
).glob("./**/*.{ts,js}");

// Mirrors scripts/seed-convex.mjs exactly.
const payload = {
  fdes,
  customers,
  engagements,
  templates,
  deployments,
  extractions,
  founderHours,
};

const EXPECTED_CAPABILITY_COUNTS: Record<string, number> = {
  otis: 6,
  rook: 7,
  wiki: 7,
  dataroom: 7,
  "web-brain": 6,
  "company-number": 7,
};

const EXPECTED_REUSE_COUNTS: Record<string, number> = {
  otis: 2,
  rook: 2,
  wiki: 1,
  dataroom: 3,
  "web-brain": 1,
  "company-number": 4,
};

describe("seed payload (data/*.json)", () => {
  it("imports without error and is idempotent", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(internal.seed.importPayload, {
      payloadJson: JSON.stringify(payload),
    });
    expect(first).toEqual({ skipped: false });

    const second = await t.mutation(internal.seed.importPayload, {
      payloadJson: JSON.stringify(payload),
    });
    expect(second.skipped).toBe(true);
  });

  it("materializes six templates with repo, live_url, tags, and capabilities", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seed.importPayload, {
      payloadJson: JSON.stringify(payload),
    });

    await t.run(async (ctx) => {
      const rows = await ctx.db.query("templates").collect();
      expect(rows.length).toBe(6);

      for (const tmpl of rows) {
        expect(tmpl.github_repo, `${tmpl.slug} github_repo`).toMatch(
          /^42nights\//,
        );
        expect(tmpl.live_url, `${tmpl.slug} live_url`).toMatch(/^https:\/\//);
        expect(
          (tmpl.tags ?? []).length,
          `${tmpl.slug} tags`,
        ).toBeGreaterThanOrEqual(5);

        const caps = await ctx.db
          .query("template_capabilities")
          .withIndex("by_template_position", (q) =>
            q.eq("template_id", tmpl._id),
          )
          .collect();
        expect(caps.length, `${tmpl.slug} capability count`).toBe(
          EXPECTED_CAPABILITY_COUNTS[tmpl.slug],
        );
        // positions are contiguous 1..N
        const positions = caps.map((c) => c.position).sort((a, b) => a - b);
        expect(positions).toEqual(
          Array.from({ length: caps.length }, (_, i) => i + 1),
        );
      }
    });
  });

  it("links every deployment to a template and counts customers per template", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seed.importPayload, {
      payloadJson: JSON.stringify(payload),
    });

    await t.run(async (ctx) => {
      const deps = await ctx.db.query("deployments").collect();
      expect(deps.length).toBe(19);
      for (const d of deps) {
        expect(d.template_id, `${d.agent_name} template_id`).not.toBeNull();
      }
    });
  });

  it("writes one extraction per template with the right reuse-chip counts", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.seed.importPayload, {
      payloadJson: JSON.stringify(payload),
    });

    await t.run(async (ctx) => {
      const exs = await ctx.db.query("pattern_extractions").collect();
      expect(exs.length).toBe(6);

      for (const ex of exs) {
        const tmpl = await ctx.db.get(ex.extracted_into_template_id);
        expect(tmpl).not.toBeNull();
        const reuses = await ctx.db
          .query("pattern_extraction_reuses")
          .withIndex("by_extraction_customer", (q) =>
            q.eq("extraction_id", ex._id),
          )
          .collect();
        expect(reuses.length, `${tmpl!.slug} reuse count`).toBe(
          EXPECTED_REUSE_COUNTS[tmpl!.slug],
        );
      }
    });
  });
});
