import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { nowIso, slugify, uniqueSlug } from "./lib/util";

export const list = query({
  args: {},
  handler: async (ctx) => ctx.db.query("pattern_extractions").collect(),
});

export const listByTemplate = query({
  args: { template_id: v.id("templates") },
  handler: async (ctx, { template_id }) =>
    ctx.db
      .query("pattern_extractions")
      .withIndex("by_template", (q) =>
        q.eq("extracted_into_template_id", template_id),
      )
      .collect(),
});

export const listReuses = query({
  args: { extraction_id: v.id("pattern_extractions") },
  handler: async (ctx, { extraction_id }) =>
    ctx.db
      .query("pattern_extraction_reuses")
      .withIndex("by_extraction_customer", (q) =>
        q.eq("extraction_id", extraction_id),
      )
      .collect(),
});

export const listAllReuses = query({
  args: {},
  handler: async (ctx) => ctx.db.query("pattern_extraction_reuses").collect(),
});

export const extract = mutation({
  args: {
    source_engagement_id: v.id("engagements"),
    source_engagement_summary: v.string(),
    target_template_id: v.union(v.id("templates"), v.null()),
    new_template: v.union(
      v.object({
        name: v.string(),
        category: v.union(
          v.literal("GTM"),
          v.literal("Ops"),
          v.literal("Content"),
          v.literal("BD"),
          v.literal("Research"),
        ),
        capabilities: v.array(v.string()),
        authored_by_fde_id: v.id("fdes"),
      }),
      v.null(),
    ),
    reused_customer_ids: v.array(v.id("customers")),
    actor_fde_id: v.id("fdes"),
  },
  handler: async (ctx, args) => {
    const eng = await ctx.db.get(args.source_engagement_id);
    if (!eng) throw new Error("source engagement not found");
    const now = nowIso();

    let template_id = args.target_template_id;
    // Track whether we minted a fresh template so the caller (esp. MCP
    // wrappers) can chain post-mint setup on the new template.
    let minted_template_slug: string | null = null;
    if (!template_id) {
      if (!args.new_template) throw new Error("provide target or new template");
      const slug = await uniqueSlug(
        ctx,
        "templates",
        slugify(args.new_template.name),
      );
      template_id = await ctx.db.insert("templates", {
        name: args.new_template.name,
        category: args.new_template.category,
        origin_customer_id: eng.customer_id,
        authored_by_fde_id: args.new_template.authored_by_fde_id,
        slug,
        created_at: now,
        updated_at: now,
        updated_by_fde_id: args.actor_fde_id,
      });
      minted_template_slug = slug;
      for (let i = 0; i < args.new_template.capabilities.length; i++) {
        await ctx.db.insert("template_capabilities", {
          template_id,
          body: args.new_template.capabilities[i],
          position: i + 1,
          created_at: now,
          updated_at: now,
          updated_by_fde_id: args.actor_fde_id,
        });
      }
    }

    const extraction_id = await ctx.db.insert("pattern_extractions", {
      source_customer_id: eng.customer_id,
      source_engagement_id: args.source_engagement_id,
      source_engagement_summary: args.source_engagement_summary,
      extracted_into_template_id: template_id,
      extracted_at: now,
      created_at: now,
      updated_at: now,
    });

    for (const customer_id of args.reused_customer_ids) {
      await ctx.db.insert("pattern_extraction_reuses", {
        extraction_id,
        customer_id,
        added_at: now,
      });
    }

    return { extraction_id, template_id, template_slug: minted_template_slug };
  },
});

export const update = mutation({
  args: {
    id: v.id("pattern_extractions"),
    patch: v.object({ source_engagement_summary: v.optional(v.string()) }),
  },
  handler: async (ctx, { id, patch }) => {
    await ctx.db.patch(id, { ...patch, updated_at: nowIso() });
  },
});

export const addReusedCustomer = mutation({
  args: {
    extraction_id: v.id("pattern_extractions"),
    customer_id: v.id("customers"),
  },
  handler: async (ctx, { extraction_id, customer_id }) => {
    const existing = await ctx.db
      .query("pattern_extraction_reuses")
      .withIndex("by_extraction_customer", (q) =>
        q.eq("extraction_id", extraction_id).eq("customer_id", customer_id),
      )
      .first();
    if (existing) return existing._id;
    return ctx.db.insert("pattern_extraction_reuses", {
      extraction_id,
      customer_id,
      added_at: nowIso(),
    });
  },
});

export const removeReusedCustomer = mutation({
  args: {
    extraction_id: v.id("pattern_extractions"),
    customer_id: v.id("customers"),
  },
  handler: async (ctx, { extraction_id, customer_id }) => {
    const row = await ctx.db
      .query("pattern_extraction_reuses")
      .withIndex("by_extraction_customer", (q) =>
        q.eq("extraction_id", extraction_id).eq("customer_id", customer_id),
      )
      .first();
    if (row) await ctx.db.delete(row._id);
  },
});

export const remove = mutation({
  args: { id: v.id("pattern_extractions") },
  handler: async (ctx, { id }) => {
    const reuses = await ctx.db
      .query("pattern_extraction_reuses")
      .withIndex("by_extraction_customer", (q) => q.eq("extraction_id", id))
      .collect();
    for (const r of reuses) await ctx.db.delete(r._id);
    await ctx.db.delete(id);
  },
});
