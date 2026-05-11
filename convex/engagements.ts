import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { logEngagementUpdate } from "./lib/audit";
import { checkNonNegative, checkPercent } from "./lib/bounds";
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

async function activeAssignments(
  ctx: MutationCtx,
  engagement_id: Id<"engagements">,
) {
  return ctx.db
    .query("engagement_assignments")
    .withIndex("by_engagement", (q) =>
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
    checkNonNegative("weekly_hours", args.weekly_hours);
    checkPercent("progress_pct", args.progress_pct);
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
      // Invariant: support phase implies the build is done. Clamp on entry
      // so we don't depend on the caller passing the right value.
      progress_pct:
        args.phase === "support" ? 100 : Math.max(0, Math.min(100, args.progress_pct)),
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
    if (patch.weekly_hours !== undefined) {
      checkNonNegative("weekly_hours", patch.weekly_hours);
    }
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
    await ctx.db.patch(id, {
      phase: nextPhase,
      last_update_at: now,
      updated_at: now,
      updated_by_fde_id: actor_fde_id,
      ...(nextPhase === "support" ? { progress_pct: 100 } : {}),
    });
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
    // Support phase pins progress at 100; setProgress can't lower it.
    // Move the engagement out of support first if you want a different value.
    if (eng.phase === "support" && pct !== 100) {
      throw new Error(
        "engagement is in support phase — progress locked at 100. Move phase first.",
      );
    }
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
    // Dedupe input — same FDE picked twice in the dialog shouldn't write two rows.
    const nextIds = new Set(fde_ids);
    const current = await activeAssignments(ctx, id);
    const currentIds = new Set(current.map((a) => a.fde_id));
    const now = nowIso();

    // Drop FDEs that are no longer assigned.
    for (const a of current) {
      if (!nextIds.has(a.fde_id)) {
        await ctx.db.patch(a._id, { removed_at: now });
      }
    }

    // Add FDEs that aren't already active. Resurrect a previously-removed
    // row when one exists so per-assignment history compacts cleanly.
    for (const fid of nextIds) {
      if (currentIds.has(fid)) continue;
      const ghost = await ctx.db
        .query("engagement_assignments")
        .withIndex("by_engagement_fde", (q) =>
          q.eq("engagement_id", id).eq("fde_id", fid),
        )
        .order("desc")
        .first();
      if (ghost && ghost.removed_at !== null) {
        await ctx.db.patch(ghost._id, { removed_at: null, assigned_at: now });
      } else {
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
    if (!Number.isInteger(base_version) || base_version < 1) {
      throw new Error(
        "base_version must be a positive integer (clients start at 1)",
      );
    }
    const eng = await ctx.db.get(id);
    if (!eng) throw new Error("engagement not found");
    if (base_version > eng.notes_version) {
      throw new Error(
        `INVALID_BASE_VERSION: client claims v${base_version}, server is at v${eng.notes_version}`,
      );
    }
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

    // Cascade pattern_extractions sourced from this engagement (and
    // their reuse junction rows). Without this, /extractions would
    // render orphan rows whose `source_engagement_id` references a
    // dead Convex Id, and any link to /engagements/[slug] from
    // pattern timelines would 404.
    const extractions = await ctx.db
      .query("pattern_extractions")
      .withIndex("by_source_engagement", (q) =>
        q.eq("source_engagement_id", id),
      )
      .collect();
    for (const p of extractions) {
      const reuses = await ctx.db
        .query("pattern_extraction_reuses")
        .withIndex("by_extraction_customer", (q) =>
          q.eq("extraction_id", p._id),
        )
        .collect();
      for (const r of reuses) await ctx.db.delete(r._id);
      await ctx.db.delete(p._id);
    }

    await logEngagementUpdate(ctx, {
      engagement_id: id,
      actor_fde_id,
      kind: "delete",
      payload: {
        cascaded_assignments: assignments.length,
        cascaded_deployments: deployments.length,
        cascaded_extractions: extractions.length,
      },
    });
    await ctx.db.delete(id);
  },
});
