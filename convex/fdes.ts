import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { nowIso, slugify, uniqueSlug } from "./lib/util";

export const list = query({
  args: {},
  handler: async (ctx) => ctx.db.query("fdes").collect(),
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) =>
    ctx.db
      .query("fdes")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first(),
});

export const create = mutation({
  args: {
    name: v.string(),
    role: v.union(
      v.literal("Founder"),
      v.literal("Senior FDE"),
      v.literal("FDE"),
      v.literal("Junior FDE"),
    ),
    is_founder: v.boolean(),
    start_date: v.string(),
    capacity_hours_per_week: v.number(),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, args) => {
    const slug = await uniqueSlug(ctx, "fdes", slugify(args.name));
    const now = nowIso();
    return ctx.db.insert("fdes", {
      name: args.name,
      role: args.role,
      is_founder: args.is_founder,
      start_date: args.start_date,
      hours_this_week: 0,
      capacity_hours_per_week: args.capacity_hours_per_week,
      agents_shipped_total: 0,
      templates_authored: 0,
      slug,
      created_at: now,
      updated_at: now,
      updated_by_fde_id: args.actor_fde_id,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("fdes"),
    patch: v.object({
      name: v.optional(v.string()),
      role: v.optional(
        v.union(
          v.literal("Founder"),
          v.literal("Senior FDE"),
          v.literal("FDE"),
          v.literal("Junior FDE"),
        ),
      ),
      is_founder: v.optional(v.boolean()),
      capacity_hours_per_week: v.optional(v.number()),
    }),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, { id, patch, actor_fde_id }) => {
    const fde = await ctx.db.get(id);
    if (!fde) throw new Error("FDE not found");
    await ctx.db.patch(id, {
      ...patch,
      updated_at: nowIso(),
      updated_by_fde_id: actor_fde_id,
    });
  },
});

export const setCapacity = mutation({
  args: {
    id: v.id("fdes"),
    capacity_hours_per_week: v.number(),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, { id, capacity_hours_per_week, actor_fde_id }) => {
    if (capacity_hours_per_week < 0)
      throw new Error("capacity must be non-negative");
    await ctx.db.patch(id, {
      capacity_hours_per_week,
      updated_at: nowIso(),
      updated_by_fde_id: actor_fde_id,
    });
  },
});

export const logHours = mutation({
  args: {
    id: v.id("fdes"),
    delta: v.number(),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, { id, delta, actor_fde_id }) => {
    const fde = await ctx.db.get(id);
    if (!fde) throw new Error("FDE not found");
    const next = Math.max(0, fde.hours_this_week + delta);
    await ctx.db.patch(id, {
      hours_this_week: next,
      updated_at: nowIso(),
      updated_by_fde_id: actor_fde_id,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("fdes") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
