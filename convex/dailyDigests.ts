import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { nowIso } from "./lib/util";

/**
 * Upsert a daily digest row. Idempotent on (user_id, date) — if a row
 * already exists for the day, it is replaced with fresh content.
 */
export const upsertToday = mutation({
  args: {
    user_id: v.string(),
    date: v.string(), // YYYY-MM-DD
    markdown: v.string(),
    sections_json: v.optional(v.string()),
    workflow_run_id: v.optional(v.id("workflow_runs")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("daily_digests")
      .withIndex("by_user_date", (q) =>
        q.eq("user_id", args.user_id).eq("date", args.date),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        markdown: args.markdown,
        ...(args.sections_json !== undefined
          ? { sections_json: args.sections_json }
          : {}),
        ...(args.workflow_run_id !== undefined
          ? { workflow_run_id: args.workflow_run_id }
          : {}),
      });
      return existing._id;
    }

    const id = await ctx.db.insert("daily_digests", {
      user_id: args.user_id,
      date: args.date,
      markdown: args.markdown,
      ...(args.sections_json !== undefined
        ? { sections_json: args.sections_json }
        : {}),
      ...(args.workflow_run_id !== undefined
        ? { workflow_run_id: args.workflow_run_id }
        : {}),
      created_at: nowIso(),
    });
    return id;
  },
});

/** Return the latest digest for a user (most recent by date). */
export const latestForUser = query({
  args: { user_id: v.string() },
  handler: async (ctx, { user_id }) => {
    return ctx.db
      .query("daily_digests")
      .withIndex("by_user_date", (q) => q.eq("user_id", user_id))
      .order("desc")
      .first();
  },
});

/** Return all digests for a user, descending. */
export const listForUser = query({
  args: { user_id: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { user_id, limit }) => {
    return ctx.db
      .query("daily_digests")
      .withIndex("by_user_date", (q) => q.eq("user_id", user_id))
      .order("desc")
      .take(limit ?? 10);
  },
});
