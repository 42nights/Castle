import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { assertWriteToken } from "./lib/writeToken";
import { nowIso } from "./lib/util";

/**
 * Append-only text deltas during streaming. The wrapper coalesces
 * deltas at ~500ms in memory then writes one row per flush. Final
 * text gets snapshotted into agent_messages.text on `agentTurns.complete`;
 * these chunks become redundant at that point (sweep-eligible later).
 *
 * Listing is folded into `agentTurns.activeFor` so the client gets
 * turn + chunks + tool events in one reactive subscription.
 */

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Delete chunks for turns that completed >7 days ago. Runs hourly via cron. */
export const reapOldChunks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
    // Find complete turns older than 7 days
    const oldTurns = await ctx.db
      .query("agent_turns")
      .withIndex("by_status_heartbeat", (q) => q.eq("status", "complete"))
      .collect();
    const stale = oldTurns.filter(
      (t) => t.completed_at !== undefined && (t.completed_at as string) < cutoff,
    );
    let deleted = 0;
    for (const turn of stale) {
      const chunks = await ctx.db
        .query("agent_message_chunks")
        .withIndex("by_turn_seq", (q) => q.eq("turn_id", turn._id))
        .collect();
      for (const c of chunks) {
        await ctx.db.delete(c._id);
        deleted++;
      }
    }
    return { deleted };
  },
});
export const append = mutation({
  args: {
    turn_id: v.id("agent_turns"),
    write_token: v.string(),
    seq: v.number(),
    delta: v.string(),
  },
  handler: async (ctx, { turn_id, write_token, seq, delta }) => {
    await assertWriteToken({ token: write_token, turnId: turn_id });
    if (!delta) return; // silently drop empty
    await ctx.db.insert("agent_message_chunks", {
      turn_id,
      seq,
      delta,
      created_at: nowIso(),
    });
    // Cheap heartbeat — any chunk write counts as proof of life.
    const turn = await ctx.db.get(turn_id);
    if (turn && turn.status === "running") {
      await ctx.db.patch(turn_id, { last_heartbeat_at: nowIso() });
    }
  },
});
