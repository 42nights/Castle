import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { nowIso } from "./lib/util";
import { logEngagementUpdate } from "./lib/audit";

// ── propose_mutation payload shapes ──────────────────────────────────────────
// Each tool_name's payload_json must parse to one of these.
type MarkTouchedPayload = {
  engagement_id: string;
  actor_fde_id: string;
  note?: string;
};
type AttentionSnoozePayload = {
  item_key: string;
  until: string;
  reason: string;
  actor_fde_id: string;
};
type AttentionResolvePayload = {
  item_key: string;
  actor_fde_id: string;
};
type AttentionResolveManualPayload = {
  id: string;
  actor_fde_id: string;
};
type CustomerSetHealthPayload = {
  id: string;
  health: "green" | "yellow" | "red";
  actor_fde_id: string | null;
};
type EngagementMovePhasePayload = {
  id: string;
  actor_fde_id: string;
  phase: "discovery" | "build" | "deployed" | "support";
};

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

/** Upsert a composio_connect prompt — replaces any pending prompt for the
 *  same (actor, toolkit) so we don't accumulate stale URLs.
 *  Also handles propose_mutation insertions (no dedup needed). */
export const propose = mutation({
  args: {
    actor_slug: v.string(),
    kind: v.union(
      v.literal("composio_connect"),
      v.literal("propose_mutation"),
    ),
    // composio_connect fields
    toolkit: v.optional(v.string()),
    url: v.optional(v.string()),
    // propose_mutation fields
    tool_name: v.optional(v.string()),
    verb: v.optional(v.string()),
    target: v.optional(v.string()),
    reason: v.optional(v.string()),
    side_effects: v.optional(v.array(v.string())),
    payload_json: v.optional(v.string()),
    created_by_turn_id: v.optional(v.id("agent_turns")),
    expires_in_sec: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = nowIso();

    if (args.kind === "composio_connect") {
      const toolkit = args.toolkit ?? "";
      const url = args.url ?? "";
      const existing = await ctx.db
        .query("agent_actions")
        .withIndex("by_actor_toolkit", (q) =>
          q.eq("actor_slug", args.actor_slug).eq("toolkit", toolkit),
        )
        .collect();
      for (const e of existing) {
        if (!e.dismissed_at) await ctx.db.delete(e._id);
      }
      return ctx.db.insert("agent_actions", {
        actor_slug: args.actor_slug,
        kind: "composio_connect",
        toolkit,
        url,
        created_at: now,
        dismissed_at: null,
      });
    }

    // propose_mutation
    const expiresSec = args.expires_in_sec ?? 300;
    const expires_at = new Date(Date.now() + expiresSec * 1000).toISOString();
    return ctx.db.insert("agent_actions", {
      actor_slug: args.actor_slug,
      kind: "propose_mutation",
      toolkit: "",
      url: "",
      created_at: now,
      dismissed_at: null,
      tool_name: args.tool_name,
      verb: args.verb,
      target: args.target,
      reason: args.reason,
      side_effects: args.side_effects,
      payload_json: args.payload_json,
      created_by_turn_id: args.created_by_turn_id,
      expires_at,
    });
  },
});

export const accept = mutation({
  args: { action_id: v.id("agent_actions") },
  handler: async (ctx, { action_id }) => {
    const row = await ctx.db.get(action_id);
    if (!row) throw new Error("action not found");
    if (row.kind !== "propose_mutation") {
      throw new Error("only propose_mutation actions can be accepted");
    }

    const now = Date.now();
    const nowStr = new Date(now).toISOString();

    // Already resolved
    if (row.resolved_outcome) {
      return { ok: false, reason: `already ${row.resolved_outcome}` };
    }

    // Expired
    if (row.expires_at && row.expires_at < nowStr) {
      await ctx.db.patch(action_id, {
        resolved_outcome: "expired",
        resolved_at: nowStr,
      });
      return { ok: false, reason: "expired" };
    }

    const toolName = row.tool_name ?? "";
    let payload: unknown;
    try {
      payload = row.payload_json ? JSON.parse(row.payload_json) : {};
    } catch {
      throw new Error("payload_json is not valid JSON");
    }

    let result: unknown;

    switch (toolName) {
      case "engagement_mark_touched": {
        const p = payload as MarkTouchedPayload;
        const id = p.engagement_id as Id<"engagements">;
        const actor_fde_id = p.actor_fde_id as Id<"fdes">;
        const eng = await ctx.db.get(id);
        if (!eng) throw new Error(`engagement ${id} not found`);
        const ts = nowStr;
        await ctx.db.patch(id, {
          last_update_at: ts,
          updated_at: ts,
          updated_by_fde_id: actor_fde_id,
        });
        await logEngagementUpdate(ctx, {
          engagement_id: id,
          actor_fde_id,
          kind: "touched",
          payload: { note: p.note ?? "" },
        });
        result = { ok: true, engagement_id: id };
        break;
      }

      case "attention_snooze": {
        const p = payload as AttentionSnoozePayload;
        const actor_fde_id = p.actor_fde_id as Id<"fdes">;
        const existing = await ctx.db
          .query("attention_dismissals")
          .withIndex("by_item", (q) => q.eq("item_key", p.item_key))
          .first();
        if (existing) {
          await ctx.db.patch(existing._id, {
            snooze_until: p.until,
            reason: p.reason,
            dismissed_at: nowStr,
            dismissed_by_fde_id: actor_fde_id,
          });
          result = { ok: true, dismissal_id: existing._id };
        } else {
          const newId = await ctx.db.insert("attention_dismissals", {
            item_key: p.item_key,
            snooze_until: p.until,
            reason: p.reason,
            dismissed_at: nowStr,
            dismissed_by_fde_id: actor_fde_id,
          });
          result = { ok: true, dismissal_id: newId };
        }
        break;
      }

      case "attention_resolve": {
        const p = payload as AttentionResolvePayload;
        const actor_fde_id = p.actor_fde_id as Id<"fdes">;
        const until = new Date(Date.now() + 365 * 86400000).toISOString();
        const existing = await ctx.db
          .query("attention_dismissals")
          .withIndex("by_item", (q) => q.eq("item_key", p.item_key))
          .first();
        if (existing) {
          await ctx.db.patch(existing._id, {
            snooze_until: until,
            reason: "resolved",
            dismissed_at: nowStr,
            dismissed_by_fde_id: actor_fde_id,
          });
        } else {
          await ctx.db.insert("attention_dismissals", {
            item_key: p.item_key,
            snooze_until: until,
            reason: "resolved",
            dismissed_at: nowStr,
            dismissed_by_fde_id: actor_fde_id,
          });
        }
        result = { ok: true, item_key: p.item_key };
        break;
      }

      case "attention_resolve_manual": {
        const p = payload as AttentionResolveManualPayload;
        const id = p.id as Id<"manual_attention_items">;
        const actor_fde_id = p.actor_fde_id as Id<"fdes">;
        await ctx.db.patch(id, {
          resolved_at: nowStr,
          resolved_by_fde_id: actor_fde_id,
          updated_at: nowStr,
          updated_by_fde_id: actor_fde_id,
        });
        result = { ok: true, id };
        break;
      }

      case "customer_set_health": {
        const p = payload as CustomerSetHealthPayload;
        const id = p.id as Id<"customers">;
        const actor_fde_id = (p.actor_fde_id ?? null) as Id<"fdes"> | null;
        await ctx.db.patch(id, {
          health: p.health,
          updated_at: nowStr,
          updated_by_fde_id: actor_fde_id,
        });
        result = { ok: true, customer_id: id, health: p.health };
        break;
      }

      case "engagement_set_phase": {
        const p = payload as EngagementMovePhasePayload;
        const id = p.id as Id<"engagements">;
        const actor_fde_id = p.actor_fde_id as Id<"fdes">;
        const eng = await ctx.db.get(id);
        if (!eng) throw new Error(`engagement ${id} not found`);
        await ctx.db.patch(id, {
          phase: p.phase,
          last_update_at: nowStr,
          updated_at: nowStr,
          updated_by_fde_id: actor_fde_id,
          ...(p.phase === "support" ? { progress_pct: 100 } : {}),
        });
        await logEngagementUpdate(ctx, {
          engagement_id: id,
          actor_fde_id,
          kind: "phase_change",
          payload: { from: eng.phase, to: p.phase },
        });
        result = { ok: true, engagement_id: id, phase: p.phase };
        break;
      }

      default:
        throw new Error(
          `unknown tool_name "${toolName}" — cannot dispatch accept`,
        );
    }

    const undo_until = new Date(now + 10_000).toISOString();
    await ctx.db.patch(action_id, {
      resolved_outcome: "accepted",
      resolved_at: nowStr,
      undo_until,
      result_json: JSON.stringify(result),
    });

    return { ok: true, result, undo_until };
  },
});

export const reject = mutation({
  args: { action_id: v.id("agent_actions") },
  handler: async (ctx, { action_id }) => {
    const row = await ctx.db.get(action_id);
    if (!row) throw new Error("action not found");
    if (row.resolved_outcome) {
      return { ok: false, reason: `already ${row.resolved_outcome}` };
    }
    const nowStr = nowIso();
    await ctx.db.patch(action_id, {
      resolved_outcome: "rejected",
      resolved_at: nowStr,
    });
    return { ok: true };
  },
});

export const dismissAction = mutation({
  args: { action_id: v.id("agent_actions") },
  handler: async (ctx, { action_id }) => {
    const row = await ctx.db.get(action_id);
    if (!row) throw new Error("action not found");
    const nowStr = nowIso();
    await ctx.db.patch(action_id, {
      dismissed_at: nowStr,
      resolved_outcome: "dismissed",
      resolved_at: nowStr,
    });
    return { ok: true };
  },
});

export const undo = mutation({
  args: { action_id: v.id("agent_actions") },
  handler: async (ctx, { action_id }) => {
    const row = await ctx.db.get(action_id);
    if (!row) throw new Error("action not found");
    if (row.resolved_outcome !== "accepted") {
      return { ok: false, reason: "action was not accepted" };
    }
    const nowStr = nowIso();
    if (!row.undo_until || row.undo_until < nowStr) {
      return { ok: false, reason: "undo window has expired" };
    }

    const toolName = row.tool_name ?? "";
    let payload: unknown;
    try {
      payload = row.payload_json ? JSON.parse(row.payload_json) : {};
    } catch {
      return { ok: false, reason: "payload_json is not valid JSON" };
    }

    switch (toolName) {
      case "attention_snooze": {
        // Reversible: delete the dismissal row that was created/updated.
        const p = payload as AttentionSnoozePayload;
        const existing = await ctx.db
          .query("attention_dismissals")
          .withIndex("by_item", (q) => q.eq("item_key", p.item_key))
          .first();
        if (existing) await ctx.db.delete(existing._id);
        await ctx.db.patch(action_id, {
          resolved_outcome: "rejected",
          resolved_at: nowStr,
          undo_until: undefined,
        });
        return { ok: true, undone: "attention_snooze", item_key: p.item_key };
      }

      case "engagement_mark_touched":
        // Best-effort: last_update_at is already set; reverting would require
        // storing the previous value. Not cleanly reversible.
        return { ok: false, reason: "not reversible" };

      case "customer_set_health":
      case "engagement_set_phase":
      case "attention_resolve":
      case "attention_resolve_manual":
        return { ok: false, reason: "not reversible" };

      default:
        return { ok: false, reason: "not reversible" };
    }
  },
});

/** Dismiss a composio_connect card (existing UI uses `{ id }`). */
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
