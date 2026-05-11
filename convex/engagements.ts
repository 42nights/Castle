import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { logEngagementUpdate } from "./lib/audit";
import { nowIso, slugify, uniqueSlug } from "./lib/util";

const phase = v.union(
  v.literal("discovery"),
  v.literal("build"),
  v.literal("deployed"),
  v.literal("support"),
);
const health = v.union(
  v.literal("green"),
  v.literal("yellow"),
  v.literal("red"),
);

export const list = query({
  args: {},
  handler: async (ctx) => ctx.db.query("engagements").collect(),
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) =>
    ctx.db
      .query("engagements")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first(),
});

export const listAssignments = query({
  args: { engagement_id: v.id("engagements") },
  handler: async (ctx, { engagement_id }) =>
    ctx.db
      .query("engagement_assignments")
      .withIndex("by_engagement", (q) => q.eq("engagement_id", engagement_id))
      .collect(),
});

export const listUpdatesByEngagement = query({
  args: { engagement_id: v.id("engagements") },
  handler: async (ctx, { engagement_id }) =>
    ctx.db
      .query("engagement_updates")
      .withIndex("by_engagement", (q) => q.eq("engagement_id", engagement_id))
      .order("desc")
      .collect(),
});

export const listUpdatesByActor = query({
  args: { actor_fde_id: v.id("fdes"), limit: v.optional(v.number()) },
  handler: async (ctx, { actor_fde_id, limit }) => {
    const q = ctx.db
      .query("engagement_updates")
      .withIndex("by_actor", (q) => q.eq("actor_fde_id", actor_fde_id))
      .order("desc");
    return limit ? q.take(limit) : q.collect();
  },
});

export const listNotesByEngagement = query({
  args: { engagement_id: v.id("engagements") },
  handler: async (ctx, { engagement_id }) =>
    ctx.db
      .query("engagement_notes")
      .withIndex("by_engagement", (q) => q.eq("engagement_id", engagement_id))
      .order("desc")
      .collect(),
});

async function activeAssignments(ctx: any, engagement_id: Id<"engagements">) {
  return ctx.db
    .query("engagement_assignments")
    .withIndex("by_engagement", (q: any) =>
      q.eq("engagement_id", engagement_id).eq("removed_at", null),
    )
    .collect();
}

export const create = mutation({
  args: {
    customer_id: v.id("customers"),
    fde_ids: v.array(v.id("fdes")),
    start_date: v.string(),
    expected_end_date: v.string(),
    phase,
    progress_pct: v.number(),
    weekly_hours: v.number(),
    health,
    notes: v.string(),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.customer_id);
    if (!customer) throw new Error("customer not found");
    const base = slugify(`${customer.slug}-${args.phase}`);
    const slug = await uniqueSlug(ctx, "engagements", base);
    const now = nowIso();
    const id = await ctx.db.insert("engagements", {
      customer_id: args.customer_id,
      start_date: args.start_date,
      expected_end_date: args.expected_end_date,
      last_update_at: now,
      phase: args.phase,
      progress_pct: args.progress_pct,
      weekly_hours: args.weekly_hours,
      health: args.health,
      notes_current: args.notes,
      notes_version: 1,
      slug,
      created_at: now,
      updated_at: now,
      updated_by_fde_id: args.actor_fde_id,
    });
    for (const fde_id of args.fde_ids) {
      await ctx.db.insert("engagement_assignments", {
        engagement_id: id,
        fde_id,
        assigned_at: now,
        removed_at: null,
        allocation_hours: null,
      });
    }
    if (args.actor_fde_id) {
      await logEngagementUpdate(ctx, {
        engagement_id: id,
        actor_fde_id: args.actor_fde_id,
        kind: "create",
        payload: { fde_ids: args.fde_ids },
      });
    }
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("engagements"),
    patch: v.object({
      expected_end_date: v.optional(v.string()),
      weekly_hours: v.optional(v.number()),
    }),
    actor_fde_id: v.id("fdes"),
  },
  handler: async (ctx, { id, patch, actor_fde_id }) => {
    await ctx.db.patch(id, { ...patch, updated_at: nowIso(), updated_by_fde_id: actor_fde_id });
  },
});

export const markTouched = mutation({
  args: {
    id: v.id("engagements"),
    actor_fde_id: v.id("fdes"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { id, actor_fde_id, note }) => {
    const now = nowIso();
    await ctx.db.patch(id, {
      last_update_at: now,
      updated_at: now,
      updated_by_fde_id: actor_fde_id,
    });
    await logEngagementUpdate(ctx, {
      engagement_id: id,
      actor_fde_id,
      kind: "touched",
      payload: { note: note ?? "" },
    });
  },
});

export const movePhase = mutation({
  args: {
    id: v.id("engagements"),
    actor_fde_id: v.id("fdes"),
    phase,
  },
  handler: async (ctx, { id, actor_fde_id, phase: nextPhase }) => {
    const eng = await ctx.db.get(id);
    if (!eng) throw new Error("engagement not found");
    const now = nowIso();
    const patch: Record<string, unknown> = {
      phase: nextPhase,
      last_update_at: now,
      updated_at: now,
      updated_by_fde_id: actor_fde_id,
    };
    if (nextPhase === "support") {
      patch.progress_pct = 100;
    }
    await ctx.db.patch(id, patch as any);
    await logEngagementUpdate(ctx, {
      engagement_id: id,
      actor_fde_id,
      kind: "phase_change",
      payload: { from: eng.phase, to: nextPhase },
    });
  },
});

export const setProgress = mutation({
  args: {
    id: v.id("engagements"),
    actor_fde_id: v.id("fdes"),
    pct: v.number(),
  },
  handler: async (ctx, { id, actor_fde_id, pct }) => {
    if (pct < 0 || pct > 100) throw new Error("progress must be 0-100");
    const eng = await ctx.db.get(id);
    if (!eng) throw new Error("engagement not found");
    const now = nowIso();
    await ctx.db.patch(id, {
      progress_pct: pct,
      last_update_at: now,
      updated_at: now,
      updated_by_fde_id: actor_fde_id,
    });
    await logEngagementUpdate(ctx, {
      engagement_id: id,
      actor_fde_id,
      kind: "progress",
      payload: { from: eng.progress_pct, to: pct },
    });
  },
});

export const setHealth = mutation({
  args: {
    id: v.id("engagements"),
    actor_fde_id: v.id("fdes"),
    health,
  },
  handler: async (ctx, { id, actor_fde_id, health: nextHealth }) => {
    const eng = await ctx.db.get(id);
    if (!eng) throw new Error("engagement not found");
    const now = nowIso();
    await ctx.db.patch(id, {
      health: nextHealth,
      last_update_at: now,
      updated_at: now,
      updated_by_fde_id: actor_fde_id,
    });
    await logEngagementUpdate(ctx, {
      engagement_id: id,
      actor_fde_id,
      kind: "health",
      payload: { from: eng.health, to: nextHealth },
    });
  },
});

export const reassign = mutation({
  args: {
    id: v.id("engagements"),
    actor_fde_id: v.id("fdes"),
    fde_ids: v.array(v.id("fdes")),
  },
  handler: async (ctx, { id, actor_fde_id, fde_ids }) => {
    const eng = await ctx.db.get(id);
    if (!eng) throw new Error("engagement not found");
    const current = await activeAssignments(ctx, id);
    const currentIds = new Set(current.map((a: any) => a.fde_id as string));
    const nextIds = new Set(fde_ids as unknown as string[]);
    const now = nowIso();
    for (const a of current) {
      if (!nextIds.has(a.fde_id as unknown as string)) {
        await ctx.db.patch(a._id, { removed_at: now });
      }
    }
    for (const fid of fde_ids) {
      if (!currentIds.has(fid as unknown as string)) {
        await ctx.db.insert("engagement_assignments", {
          engagement_id: id,
          fde_id: fid,
          assigned_at: now,
          removed_at: null,
          allocation_hours: null,
        });
      }
    }
    await ctx.db.patch(id, {
      last_update_at: now,
      updated_at: now,
      updated_by_fde_id: actor_fde_id,
    });
    await logEngagementUpdate(ctx, {
      engagement_id: id,
      actor_fde_id,
      kind: "reassign",
      payload: { fde_ids },
    });
  },
});

export const saveNotes = mutation({
  args: {
    id: v.id("engagements"),
    actor_fde_id: v.id("fdes"),
    body: v.string(),
    base_version: v.number(),
    client_id: v.string(),
  },
  handler: async (ctx, { id, actor_fde_id, body, base_version, client_id }) => {
    const eng = await ctx.db.get(id);
    if (!eng) throw new Error("engagement not found");
    if (eng.notes_version !== base_version) {
      throw new Error("STALE_BASE_VERSION");
    }
    const now = nowIso();
    const nextVersion = eng.notes_version + 1;
    await ctx.db.patch(id, {
      notes_current: body,
      notes_version: nextVersion,
      last_update_at: now,
      updated_at: now,
      updated_by_fde_id: actor_fde_id,
    });
    await ctx.db.insert("engagement_notes", {
      engagement_id: id,
      body,
      actor_fde_id,
      client_id,
      base_version,
      created_at: now,
    });
    await logEngagementUpdate(ctx, {
      engagement_id: id,
      actor_fde_id,
      kind: "note",
      payload: { version: nextVersion, length: body.length },
    });
    return { version: nextVersion };
  },
});

export const remove = mutation({
  args: { id: v.id("engagements"), actor_fde_id: v.id("fdes") },
  handler: async (ctx, { id, actor_fde_id }) => {
    const assignments = await ctx.db
      .query("engagement_assignments")
      .withIndex("by_engagement", (q) => q.eq("engagement_id", id))
      .collect();
    for (const a of assignments) await ctx.db.delete(a._id);
    const deployments = await ctx.db
      .query("deployments")
      .withIndex("by_engagement", (q) => q.eq("engagement_id", id))
      .collect();
    for (const d of deployments) await ctx.db.delete(d._id);
    await logEngagementUpdate(ctx, {
      engagement_id: id,
      actor_fde_id,
      kind: "delete",
      payload: {},
    });
    await ctx.db.delete(id);
  },
});
