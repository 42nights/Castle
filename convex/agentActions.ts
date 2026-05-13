import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { nowIso } from "./lib/util";

const kind = v.union(v.literal("composio_connect"));

export const listOpen = query({
  args: { actor_slug: v.string() },
  handler: async (ctx, { actor_slug }) => {
    return ctx.db
      .query("agent_actions")
      .withIndex("by_actor_open", (q) =>
        q.eq("actor_slug", actor_slug).eq("dismissed_at", null),
      )
      .order("desc")
      .collect();
  },
});

/** Upsert a connection prompt — replaces any pending prompt for the
 *  same (actor, toolkit) so we don't accumulate stale URLs. */
export const propose = mutation({
  args: {
    actor_slug: v.string(),
    kind,
    toolkit: v.string(),
    url: v.string(),
  },
  handler: async (ctx, { actor_slug, kind: k, toolkit, url }) => {
    const existing = await ctx.db
      .query("agent_actions")
      .withIndex("by_actor_toolkit", (q) =>
        q.eq("actor_slug", actor_slug).eq("toolkit", toolkit),
      )
      .collect();
    for (const e of existing) {
      if (!e.dismissed_at) await ctx.db.delete(e._id);
    }
    return ctx.db.insert("agent_actions", {
      actor_slug,
      kind: k,
      toolkit,
      url,
      created_at: nowIso(),
      dismissed_at: null,
    });
  },
});

export const dismiss = mutation({
  args: { id: v.id("agent_actions") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { dismissed_at: nowIso() });
  },
});

/** Sweep all open prompts for an actor — used by the /connections
 *  callback to clear out CTAs once the user has finished OAuth. */
export const dismissAllForActor = mutation({
  args: { actor_slug: v.string() },
  handler: async (ctx, { actor_slug }) => {
    const open = await ctx.db
      .query("agent_actions")
      .withIndex("by_actor_open", (q) =>
        q.eq("actor_slug", actor_slug).eq("dismissed_at", null),
      )
      .collect();
    const now = nowIso();
    for (const a of open) await ctx.db.patch(a._id, { dismissed_at: now });
    return open.length;
  },
});
