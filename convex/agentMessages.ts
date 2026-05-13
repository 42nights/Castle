import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { nowIso } from "./lib/util";

const role = v.union(v.literal("user"), v.literal("assistant"));

/** One-off: wipe legacy rows from before conversation_id existed. Safe
 *  to call repeatedly; deletes any row without a conversation_id field
 *  set. Used by a startup migration; not exposed in the UI. */
export const wipeLegacy = mutation({
  args: {},
  handler: async (ctx) => {
    let removed = 0;
    for await (const row of ctx.db.query("agent_messages")) {
      const r = row as unknown as { conversation_id?: string };
      if (!r.conversation_id) {
        await ctx.db.delete(row._id);
        removed++;
      }
    }
    return removed;
  },
});

// ─────────────────────────── conversations ───────────────────────────

export const listConversations = query({
  args: { actor_slug: v.string() },
  handler: async (ctx, { actor_slug }) =>
    ctx.db
      .query("agent_conversations")
      .withIndex("by_actor_updated", (q) => q.eq("actor_slug", actor_slug))
      .order("desc")
      .collect(),
});

export const createConversation = mutation({
  args: { actor_slug: v.string(), title: v.optional(v.string()) },
  handler: async (ctx, { actor_slug, title }) => {
    const now = nowIso();
    // Hermes session name must be opaque and stable. Use a short random
    // suffix so two conversations never share a memory.
    const session = `castle-${actor_slug}-${Math.random().toString(36).slice(2, 8)}`;
    return ctx.db.insert("agent_conversations", {
      actor_slug,
      title: title?.trim() || "New chat",
      hermes_session: session,
      created_at: now,
      updated_at: now,
    });
  },
});

export const renameConversation = mutation({
  args: { id: v.id("agent_conversations"), title: v.string() },
  handler: async (ctx, { id, title }) => {
    await ctx.db.patch(id, {
      title: title.trim() || "Untitled",
      updated_at: nowIso(),
    });
  },
});

export const deleteConversation = mutation({
  args: { id: v.id("agent_conversations") },
  handler: async (ctx, { id }) => {
    // Cascade delete messages.
    const msgs = await ctx.db
      .query("agent_messages")
      .withIndex("by_conversation_time", (q) => q.eq("conversation_id", id))
      .collect();
    for (const m of msgs) await ctx.db.delete(m._id);
    await ctx.db.delete(id);
  },
});

// ─────────────────────────── messages ───────────────────────────

export const list = query({
  args: {
    conversation_id: v.id("agent_conversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { conversation_id, limit }) => {
    const rows = await ctx.db
      .query("agent_messages")
      .withIndex("by_conversation_time", (q) =>
        q.eq("conversation_id", conversation_id),
      )
      .order("asc")
      .collect();
    const cap = limit ?? 200;
    return rows.slice(-cap);
  },
});

export const append = mutation({
  args: {
    conversation_id: v.id("agent_conversations"),
    actor_slug: v.string(),
    role,
    text: v.string(),
  },
  handler: async (ctx, { conversation_id, actor_slug, role: r, text }) => {
    const now = nowIso();
    const id = await ctx.db.insert("agent_messages", {
      conversation_id,
      actor_slug,
      role: r,
      text,
      created_at: now,
    });
    // Bump conversation updated_at so it floats to the top of the
    // sidebar. Also auto-title from the first user message if the
    // current title is still the default.
    const conv = await ctx.db.get(conversation_id);
    if (conv) {
      const patch: Partial<typeof conv> = { updated_at: now };
      if (r === "user" && conv.title === "New chat") {
        patch.title = text.trim().slice(0, 48) || "New chat";
      }
      await ctx.db.patch(conversation_id, patch);
    }
    return id;
  },
});

/** Clear the visible transcript for a conversation. Does NOT touch
 *  Hermes' underlying session — that's its own memory store. */
export const clear = mutation({
  args: { conversation_id: v.id("agent_conversations") },
  handler: async (ctx, { conversation_id }) => {
    const rows = await ctx.db
      .query("agent_messages")
      .withIndex("by_conversation_time", (q) =>
        q.eq("conversation_id", conversation_id),
      )
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  },
});
