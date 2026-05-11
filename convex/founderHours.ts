import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { nowIso } from "./lib/util";

export const list = query({
  args: {},
  handler: async (ctx) => ctx.db.query("founder_hours").collect(),
});

export const upsertMonth = mutation({
  args: {
    month: v.string(),
    founder_hours_total: v.number(),
    new_arr_dollars: v.number(),
  },
  handler: async (ctx, { month, founder_hours_total, new_arr_dollars }) => {
    const now = nowIso();
    const existing = await ctx.db
      .query("founder_hours")
      .withIndex("by_month", (q) => q.eq("month", month))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        founder_hours_total,
        new_arr_dollars,
        updated_at: now,
      });
      return existing._id;
    }
    return ctx.db.insert("founder_hours", {
      month,
      founder_hours_total,
      new_arr_dollars,
      created_at: now,
      updated_at: now,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("founder_hours") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
