import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { checkNonNegative, checkPercent } from "./lib/bounds";
import { nowIso } from "./lib/util";
import { resolveOrgId, scopeToOrg } from "./lib/org";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await resolveOrgId(ctx);
    const rows = await ctx.db.query("deployments").collect();
    return scopeToOrg(rows, orgId);
  },
});

export const listByEngagement = query({
  args: { engagement_id: v.id("engagements") },
  handler: async (ctx, { engagement_id }) =>
    ctx.db
      .query("deployments")
      .withIndex("by_engagement", (q) => q.eq("engagement_id", engagement_id))
      .collect(),
});

export const listByTemplate = query({
  args: { template_id: v.id("templates") },
  handler: async (ctx, { template_id }) =>
    ctx.db
      .query("deployments")
      .withIndex("by_template", (q) => q.eq("template_id", template_id))
      .collect(),
});

export const create = mutation({
  args: {
    customer_id: v.id("customers"),
    engagement_id: v.id("engagements"),
    template_id: v.union(v.id("templates"), v.null()),
    agent_name: v.string(),
    deployed_at: v.string(),
    hours_replaced_per_week: v.number(),
    customization_pct: v.number(),
  },
  handler: async (ctx, args) => {
    checkNonNegative("hours_replaced_per_week", args.hours_replaced_per_week);
    checkPercent("customization_pct", args.customization_pct);
    const now = nowIso();
    const orgId = await resolveOrgId(ctx);
    return ctx.db.insert("deployments", {
      ...args,
      created_at: now,
      updated_at: now,
      ...(orgId !== null ? { organization_id: orgId } : {}),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("deployments"),
    patch: v.object({
      template_id: v.optional(v.union(v.id("templates"), v.null())),
      agent_name: v.optional(v.string()),
      deployed_at: v.optional(v.string()),
      hours_replaced_per_week: v.optional(v.number()),
      customization_pct: v.optional(v.number()),
    }),
  },
  handler: async (ctx, { id, patch }) => {
    if (patch.hours_replaced_per_week !== undefined) {
      checkNonNegative("hours_replaced_per_week", patch.hours_replaced_per_week);
    }
    if (patch.customization_pct !== undefined) {
      checkPercent("customization_pct", patch.customization_pct);
    }
    await ctx.db.patch(id, { ...patch, updated_at: nowIso() });
  },
});

export const remove = mutation({
  args: { id: v.id("deployments") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
