import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { nowIso, slugify, uniqueSlug } from "./lib/util";

const category = v.union(
  v.literal("GTM"),
  v.literal("Ops"),
  v.literal("Content"),
  v.literal("BD"),
  v.literal("Research"),
);

export const list = query({
  args: {},
  handler: async (ctx) => ctx.db.query("templates").collect(),
});

export const listCapabilities = query({
  args: { template_id: v.id("templates") },
  handler: async (ctx, { template_id }) =>
    ctx.db
      .query("template_capabilities")
      .withIndex("by_template_position", (q) =>
        q.eq("template_id", template_id),
      )
      .collect(),
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) =>
    ctx.db
      .query("templates")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first(),
});

export const create = mutation({
  args: {
    name: v.string(),
    category,
    capabilities: v.array(v.string()),
    origin_customer_id: v.id("customers"),
    authored_by_fde_id: v.id("fdes"),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, args) => {
    const slug = await uniqueSlug(ctx, "templates", slugify(args.name));
    const now = nowIso();
    const id = await ctx.db.insert("templates", {
      name: args.name,
      category: args.category,
      origin_customer_id: args.origin_customer_id,
      authored_by_fde_id: args.authored_by_fde_id,
      slug,
      created_at: now,
      updated_at: now,
      updated_by_fde_id: args.actor_fde_id,
    });
    for (let i = 0; i < args.capabilities.length; i++) {
      await ctx.db.insert("template_capabilities", {
        template_id: id,
        body: args.capabilities[i],
        position: i + 1,
        created_at: now,
        updated_at: now,
        updated_by_fde_id: args.actor_fde_id,
      });
    }
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("templates"),
    patch: v.object({
      name: v.optional(v.string()),
      category: v.optional(category),
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

export const addCapability = mutation({
  args: {
    template_id: v.id("templates"),
    body: v.string(),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, { template_id, body, actor_fde_id }) => {
    const last = await ctx.db
      .query("template_capabilities")
      .withIndex("by_template_position", (q) =>
        q.eq("template_id", template_id),
      )
      .order("desc")
      .first();
    const position = (last?.position ?? 0) + 1;
    const now = nowIso();
    return ctx.db.insert("template_capabilities", {
      template_id,
      body,
      position,
      created_at: now,
      updated_at: now,
      updated_by_fde_id: actor_fde_id,
    });
  },
});

export const updateCapability = mutation({
  args: {
    capability_id: v.id("template_capabilities"),
    body: v.string(),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, { capability_id, body, actor_fde_id }) => {
    await ctx.db.patch(capability_id, {
      body,
      updated_at: nowIso(),
      updated_by_fde_id: actor_fde_id,
    });
  },
});

export const reorderCapability = mutation({
  args: {
    capability_id: v.id("template_capabilities"),
    new_position: v.number(),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, { capability_id, new_position, actor_fde_id }) => {
    await ctx.db.patch(capability_id, {
      position: new_position,
      updated_at: nowIso(),
      updated_by_fde_id: actor_fde_id,
    });
  },
});

export const removeCapability = mutation({
  args: { capability_id: v.id("template_capabilities") },
  handler: async (ctx, { capability_id }) => {
    await ctx.db.delete(capability_id);
  },
});

export const remove = mutation({
  args: { id: v.id("templates") },
  handler: async (ctx, { id }) => {
    const caps = await ctx.db
      .query("template_capabilities")
      .withIndex("by_template_position", (q) => q.eq("template_id", id))
      .collect();
    for (const c of caps) await ctx.db.delete(c._id);
    await ctx.db.delete(id);
  },
});
