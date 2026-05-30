import { query } from "./_generated/server";

/**
 * Single aggregate query that returns one consistent snapshot of every table
 * the overview page needs. Better than nine separate preloadQuery calls,
 * which Convex doesn't guarantee to be drawn from the same DB snapshot.
 */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    const [
      fdes,
      customers,
      engagements,
      assignments,
      deployments,
      templates,
      capabilities,
      extractions,
      reuses,
      founderHours,
    ] = await Promise.all([
      ctx.db.query("fdes").collect(),
      ctx.db.query("customers").collect(),
      ctx.db.query("engagements").collect(),
      ctx.db.query("engagement_assignments").collect(),
      ctx.db.query("deployments").collect(),
      ctx.db.query("templates").collect(),
      ctx.db.query("template_capabilities").collect(),
      ctx.db.query("pattern_extractions").collect(),
      ctx.db.query("pattern_extraction_reuses").collect(),
      ctx.db.query("founder_hours").collect(),
    ]);
    return {
      fdes,
      customers,
      engagements,
      assignments,
      deployments,
      // Archived templates hidden from the snapshot feeding the grid
      // (operators included). They surface only in the collapsed,
      // operator-only Archived section (templates.listArchived).
      templates: templates.filter((t) => !t.archived_at),
      capabilities,
      extractions,
      reuses,
      founderHours,
    };
  },
});
