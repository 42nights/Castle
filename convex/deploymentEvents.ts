import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { nowIso } from "./lib/util";

/** Append an event from a sibling product. Called by the API route after
 *  secret verification — no operator-gate needed here. */
export const record = mutation({
  args: {
    deployment_id: v.string(),
    kind: v.string(),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("deployment_events", {
      deployment_id: args.deployment_id,
      kind: args.kind,
      payload: args.payload,
      received_at: nowIso(),
    });
  },
});

/** Most recent events for a deployment, newest first. Default limit 50. */
export const listByDeployment = query({
  args: {
    deployment_id: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { deployment_id, limit }) => {
    const cap = limit ?? 50;
    return ctx.db
      .query("deployment_events")
      .withIndex("by_deployment_received", (q) =>
        q.eq("deployment_id", deployment_id),
      )
      .order("desc")
      .take(cap);
  },
});

/** Total event count for a deployment — lightweight badge number. */
export const recentCountByDeployment = query({
  args: { deployment_id: v.string() },
  handler: async (ctx, { deployment_id }) => {
    const rows = await ctx.db
      .query("deployment_events")
      .withIndex("by_deployment_received", (q) =>
        q.eq("deployment_id", deployment_id),
      )
      .collect();
    return rows.length;
  },
});
