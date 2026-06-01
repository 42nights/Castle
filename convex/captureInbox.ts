import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { nowIso } from "./lib/util";

/** Insert a new capture_inbox item. */
export const insert = mutation({
  args: {
    user_id: v.string(),
    body: v.string(),
    source: v.union(
      v.literal("chat"),
      v.literal("email"),
      v.literal("manual"),
    ),
  },
  handler: async (ctx, { user_id, body, source }) => {
    return ctx.db.insert("capture_inbox", {
      user_id,
      body,
      source,
      status: "pending",
      created_at: nowIso(),
    });
  },
});

/** List pending items for a user, most recent first (max 20). */
export const listPending = query({
  args: { user_id: v.string() },
  handler: async (ctx, { user_id }) => {
    return ctx.db
      .query("capture_inbox")
      .withIndex("by_user_status", (q) =>
        q.eq("user_id", user_id).eq("status", "pending"),
      )
      .order("desc")
      .take(20);
  },
});
