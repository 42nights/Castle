import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { nowIso } from "./lib/util";

const workflowStatus = v.union(
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("awaiting_confirmation"),
);

/** Create a workflow_runs row and return its id. */
export const start = mutation({
  args: {
    user_id: v.string(),
    workflow_slug: v.string(),
    trigger: v.union(
      v.literal("manual"),
      v.literal("scheduled"),
      v.literal("event"),
    ),
  },
  handler: async (ctx, { user_id, workflow_slug, trigger }) => {
    const id = await ctx.db.insert("workflow_runs", {
      user_id,
      workflow_slug,
      trigger,
      status: "running",
      steps_json: "[]",
      started_at: nowIso(),
    });
    return id;
  },
});

/** Mark a run as succeeded or failed, writing the step trace. */
export const finish = mutation({
  args: {
    id: v.id("workflow_runs"),
    status: workflowStatus,
    steps_json: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { id, status, steps_json, error }) => {
    await ctx.db.patch(id, {
      status,
      steps_json,
      ...(error !== undefined ? { error } : {}),
      finished_at: nowIso(),
    });
  },
});

/** List the N most recent runs for a user. */
export const listForUser = query({
  args: { user_id: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { user_id, limit }) => {
    return ctx.db
      .query("workflow_runs")
      .withIndex("by_user_started", (q) => q.eq("user_id", user_id))
      .order("desc")
      .take(limit ?? 20);
  },
});
