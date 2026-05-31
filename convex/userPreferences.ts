import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { nowIso } from "./lib/util";

/** Get or create user preferences. Defaults: LA timezone, always-send policy. */
export const getOrCreate = mutation({
  args: { user_id: v.string() },
  handler: async (ctx, { user_id }) => {
    const existing = await ctx.db
      .query("user_preferences")
      .withIndex("by_user", (q) => q.eq("user_id", user_id))
      .first();
    if (existing) return existing;

    const now = nowIso();
    const id = await ctx.db.insert("user_preferences", {
      user_id,
      timezone: "America/Los_Angeles",
      email_send_policy: "always",
      created_at: now,
      updated_at: now,
    });
    return ctx.db.get(id);
  },
});

/** Read preferences without creating. */
export const getForUser = query({
  args: { user_id: v.string() },
  handler: async (ctx, { user_id }) => {
    return ctx.db
      .query("user_preferences")
      .withIndex("by_user", (q) => q.eq("user_id", user_id))
      .first();
  },
});

/** Patch preference fields. */
export const update = mutation({
  args: {
    user_id: v.string(),
    patch: v.object({
      timezone: v.optional(v.string()),
      email_send_policy: v.optional(
        v.union(v.literal("always"), v.literal("draft_only")),
      ),
      personal_context_blurb: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { user_id, patch }) => {
    const existing = await ctx.db
      .query("user_preferences")
      .withIndex("by_user", (q) => q.eq("user_id", user_id))
      .first();
    if (!existing) throw new Error(`No preferences found for user ${user_id}`);
    await ctx.db.patch(existing._id, { ...patch, updated_at: nowIso() });
  },
});
