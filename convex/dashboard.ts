import { query } from "./_generated/server";
import { resolveOrgId, scopeToOrg } from "./lib/org";

/**
 * Single aggregate query that returns one consistent snapshot of every table
 * the overview page needs. Better than nine separate preloadQuery calls,
 * which Convex doesn't guarantee to be drawn from the same DB snapshot.
 *
 * When CASTLE_MULTITENANT is off (default) resolveOrgId returns null and
 * scopeToOrg is a no-op — behavior is byte-identical to before P33.
 */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await resolveOrgId(ctx);
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
      fdes: scopeToOrg(fdes, orgId),
      customers: scopeToOrg(customers, orgId),
      engagements: scopeToOrg(engagements, orgId),
      assignments,
      deployments: scopeToOrg(deployments, orgId),
      // Archived templates hidden from the snapshot feeding the grid
      // (operators included). They surface only in the collapsed,
      // operator-only Archived section (templates.listArchived).
      templates: scopeToOrg(templates, orgId).filter((t) => !t.archived_at),
      capabilities,
      extractions: scopeToOrg(extractions, orgId),
      reuses,
      founderHours: scopeToOrg(founderHours, orgId),
    };
  },
});
