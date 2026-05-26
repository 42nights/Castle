import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertOperatorRead } from "./lib/assertOperator";
import { checkNonNegative } from "./lib/bounds";
import { nowIso, slugify, uniqueSlug } from "./lib/util";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await assertOperatorRead(ctx);
    return ctx.db.query("fdes").collect();
  },
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
    checkNonNegative("capacity_hours_per_week", args.capacity_hours_per_week);
    const slug = await uniqueSlug(ctx, "fdes", slugify(args.name));
    const now = nowIso();
    const id = await ctx.db.insert("fdes", {
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
    return { id, slug };
  },
});

function cleanTags(tags: string[]): string[] {
  return Array.from(
    new Set(tags.map((t) => t.trim()).filter((t) => t && t !== "—")),
  );
}

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
      tags: v.optional(v.array(v.string())),
    }),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, { id, patch, actor_fde_id }) => {
    const fde = await ctx.db.get(id);
    if (!fde) throw new Error("FDE not found");
    if (patch.capacity_hours_per_week !== undefined) {
      checkNonNegative("capacity_hours_per_week", patch.capacity_hours_per_week);
    }
    // Normalize tags here too — callers shouldn't be able to bypass the
    // trim/dedupe contract by routing through update instead of setTags.
    const cleaned: typeof patch = patch.tags
      ? { ...patch, tags: cleanTags(patch.tags) }
      : patch;
    await ctx.db.patch(id, {
      ...cleaned,
      updated_at: nowIso(),
      updated_by_fde_id: actor_fde_id,
    });
  },
});

/** Replace the full tags array. Trims, dedupes, drops empties. */
export const setTags = mutation({
  args: {
    id: v.id("fdes"),
    tags: v.array(v.string()),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, { id, tags, actor_fde_id }) => {
    await ctx.db.patch(id, {
      tags: cleanTags(tags),
      updated_at: nowIso(),
      updated_by_fde_id: actor_fde_id,
    });
  },
});

/** Atomically add a tag to an FDE — re-reads inside the mutation so two
 *  concurrent add_tag calls don't lose updates. */
export const addTag = mutation({
  args: {
    id: v.id("fdes"),
    tag: v.string(),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, { id, tag, actor_fde_id }) => {
    const fde = await ctx.db.get(id);
    if (!fde) throw new Error("FDE not found");
    const next = cleanTags([...(fde.tags ?? []), tag]);
    await ctx.db.patch(id, {
      tags: next,
      updated_at: nowIso(),
      updated_by_fde_id: actor_fde_id,
    });
  },
});

/** Atomically remove a tag from an FDE. Case-insensitive match so the
 *  caller doesn't have to worry about capitalization. */
export const removeTag = mutation({
  args: {
    id: v.id("fdes"),
    tag: v.string(),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, { id, tag, actor_fde_id }) => {
    const fde = await ctx.db.get(id);
    if (!fde) throw new Error("FDE not found");
    const needle = tag.trim().toLowerCase();
    const next = (fde.tags ?? []).filter(
      (t) => t.trim().toLowerCase() !== needle,
    );
    await ctx.db.patch(id, {
      tags: next,
      updated_at: nowIso(),
      updated_by_fde_id: actor_fde_id,
    });
  },
});

/** Distinct tag values across all FDEs (alphabetical). Used by the
 *  FdeTagsInput autocomplete to surface the existing pool. */
export const listTags = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("fdes").collect();
    const set = new Set<string>();
    for (const f of all) {
      for (const t of f.tags ?? []) {
        const trimmed = t.trim();
        if (trimmed && trimmed !== "—") set.add(trimmed);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
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
