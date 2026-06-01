import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { nowIso } from "./lib/util";

const MAX_RECENTS = 10;

/**
 * Record a recently viewed entity for a user.
 * - Deduplicates by slug: if already present, updates viewed_at.
 * - Caps at MAX_RECENTS per user, evicting the oldest by viewed_at.
 */
export const record = mutation({
  args: {
    user_id: v.string(),
    kind: v.union(
      v.literal("customer"),
      v.literal("engagement"),
      v.literal("fde"),
      v.literal("template"),
      v.literal("extraction"),
    ),
    slug: v.string(),
    title: v.string(),
  },
  handler: async (ctx, { user_id, kind, slug, title }) => {
    const now = nowIso();

    // Check for existing row with this slug (same user)
    const existing = await ctx.db
      .query("user_recents")
      .withIndex("by_user_slug", (q) => q.eq("user_id", user_id).eq("slug", slug))
      .first();

    if (existing) {
      // Bump viewed_at + refresh title in case it changed
      await ctx.db.patch(existing._id, { viewed_at: now, title, kind });
      return;
    }

    // Insert new row
    await ctx.db.insert("user_recents", { user_id, kind, slug, title, viewed_at: now });

    // Evict oldest if over cap
    const all = await ctx.db
      .query("user_recents")
      .withIndex("by_user_viewed", (q) => q.eq("user_id", user_id))
      .collect();

    if (all.length > MAX_RECENTS) {
      // Sort ascending by viewed_at so index order = oldest first
      const sorted = [...all].sort((a, b) => a.viewed_at.localeCompare(b.viewed_at));
      const toDelete = sorted.slice(0, all.length - MAX_RECENTS);
      await Promise.all(toDelete.map((row) => ctx.db.delete(row._id)));
    }
  },
});

/**
 * List the last MAX_RECENTS viewed entities for a user, newest first.
 */
export const listForUser = query({
  args: { user_id: v.string() },
  handler: async (ctx, { user_id }) => {
    const rows = await ctx.db
      .query("user_recents")
      .withIndex("by_user_viewed", (q) => q.eq("user_id", user_id))
      .order("desc")
      .take(MAX_RECENTS);
    return rows;
  },
});
