import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { nowIso } from "./lib/util";
import { BUILTIN_WORKFLOWS } from "../src/workflows/registry";

/** List all workflow definitions visible to a user (built-ins + their own). */
export const list = query({
  args: { user_id: v.optional(v.string()) },
  handler: async (ctx, { user_id }) => {
    // Built-ins (user_id = null)
    const builtins = await ctx.db
      .query("assistant_workflows")
      .withIndex("by_user", (q) => q.eq("user_id", null))
      .collect();

    if (!user_id) return builtins;

    // User-authored workflows
    const userDefs = await ctx.db
      .query("assistant_workflows")
      .withIndex("by_user", (q) => q.eq("user_id", user_id))
      .collect();

    return [...builtins, ...userDefs];
  },
});

/**
 * Upsert all built-in workflow definitions. Called on deploy / seed.
 * Idempotent — matches on slug, updates if the definition changed.
 */
export const seedBuiltins = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = nowIso();
    for (const wf of BUILTIN_WORKFLOWS) {
      const existing = await ctx.db
        .query("assistant_workflows")
        .withIndex("by_slug", (q) => q.eq("slug", wf.slug))
        .filter((q) => q.eq(q.field("user_id"), null))
        .first();

      const definitionJson = JSON.stringify(wf);

      if (existing) {
        await ctx.db.patch(existing._id, {
          name: wf.name,
          description: wf.description,
          definition_json: definitionJson,
          updated_at: now,
        });
      } else {
        await ctx.db.insert("assistant_workflows", {
          user_id: null,
          slug: wf.slug,
          name: wf.name,
          description: wf.description,
          source: "builtin",
          definition_json: definitionJson,
          enabled: true,
          created_at: now,
          updated_at: now,
        });
      }
    }
  },
});

/** Get a workflow by slug (built-in takes priority over user-authored). */
export const getBySlug = query({
  args: { slug: v.string(), user_id: v.optional(v.string()) },
  handler: async (ctx, { slug, user_id }) => {
    // Check built-ins first
    const builtin = await ctx.db
      .query("assistant_workflows")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .filter((q) => q.eq(q.field("user_id"), null))
      .first();
    if (builtin) return builtin;

    if (!user_id) return null;

    return ctx.db
      .query("assistant_workflows")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .filter((q) => q.eq(q.field("user_id"), user_id))
      .first();
  },
});

/** Upsert a user-authored workflow definition. */
export const upsert = mutation({
  args: {
    user_id: v.string(),
    slug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    definition_json: v.string(),
  },
  handler: async (ctx, args) => {
    const now = nowIso();
    const existing = await ctx.db
      .query("assistant_workflows")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .filter((q) => q.eq(q.field("user_id"), args.user_id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        description: args.description,
        definition_json: args.definition_json,
        updated_at: now,
      });
      return existing._id;
    }

    return ctx.db.insert("assistant_workflows", {
      user_id: args.user_id,
      slug: args.slug,
      name: args.name,
      description: args.description,
      source: "user",
      definition_json: args.definition_json,
      enabled: true,
      created_at: now,
      updated_at: now,
    });
  },
});
