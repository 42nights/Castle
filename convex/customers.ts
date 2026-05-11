import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { nowIso, slugify, uniqueSlug } from "./lib/util";

const status = v.union(
  v.literal("active"),
  v.literal("churned"),
  v.literal("paused"),
);
const health = v.union(
  v.literal("green"),
  v.literal("yellow"),
  v.literal("red"),
);

export const list = query({
  args: {},
  handler: async (ctx) => ctx.db.query("customers").collect(),
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) =>
    ctx.db
      .query("customers")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first(),
});

export const create = mutation({
  args: {
    name: v.string(),
    backed_by: v.array(v.string()),
    start_date: v.string(),
    status,
    current_mrr: v.number(),
    is_pe: v.boolean(),
    health,
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, args) => {
    const slug = await uniqueSlug(ctx, "customers", slugify(args.name));
    const now = nowIso();
    return ctx.db.insert("customers", {
      name: args.name,
      backed_by: args.backed_by,
      start_date: args.start_date,
      status: args.status,
      current_mrr: args.current_mrr,
      is_pe: args.is_pe,
      health: args.health,
      slug,
      created_at: now,
      updated_at: now,
      updated_by_fde_id: args.actor_fde_id,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("customers"),
    patch: v.object({
      name: v.optional(v.string()),
      backed_by: v.optional(v.array(v.string())),
      start_date: v.optional(v.string()),
      is_pe: v.optional(v.boolean()),
    }),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, { id, patch, actor_fde_id }) => {
    await ctx.db.patch(id, {
      ...patch,
      updated_at: nowIso(),
      updated_by_fde_id: actor_fde_id,
    });
  },
});

export const setHealth = mutation({
  args: {
    id: v.id("customers"),
    health,
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, { id, health: nextHealth, actor_fde_id }) => {
    await ctx.db.patch(id, {
      health: nextHealth,
      updated_at: nowIso(),
      updated_by_fde_id: actor_fde_id,
    });
  },
});

export const setStatus = mutation({
  args: {
    id: v.id("customers"),
    status,
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, { id, status: nextStatus, actor_fde_id }) => {
    await ctx.db.patch(id, {
      status: nextStatus,
      updated_at: nowIso(),
      updated_by_fde_id: actor_fde_id,
    });
  },
});

export const setMrr = mutation({
  args: {
    id: v.id("customers"),
    current_mrr: v.number(),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, { id, current_mrr, actor_fde_id }) => {
    if (current_mrr < 0) throw new Error("MRR must be non-negative");
    await ctx.db.patch(id, {
      current_mrr,
      updated_at: nowIso(),
      updated_by_fde_id: actor_fde_id,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("customers") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
