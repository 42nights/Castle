import { internalMutation } from "./_generated/server";

/**
 * Clear all data from all tables in the correct order to respect foreign keys.
 * Called manually via: npx convex run clearAll:clearAllData
 */
export const clearAllData = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Delete in reverse dependency order to avoid constraint violations
    const tables = [
      "pattern_extraction_reuses",
      "pattern_extractions",
      "template_capabilities",
      "deployments",
      "engagement_assignments",
      "engagements",
      "templates",
      "customers",
      "fdes",
      "founder_hours",
    ] as const;

    const counts: Record<string, number> = {};

    for (const table of tables) {
      const docs = await ctx.db.query(table).collect();
      counts[table] = docs.length;
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
      }
    }

    return {
      success: true,
      deleted: counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    };
  },
});
