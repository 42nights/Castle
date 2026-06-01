import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertWriteToken } from "./lib/writeToken";
import { tryConversation } from "./lib/conversationAuth";
import { nowIso } from "./lib/util";

/**
 * Append-only tool / thought events during streaming. Listing is
 * folded into `agentTurns.activeFor`.
 */

/**
 * Events for a single (usually completed) turn, so the transcript can
 * re-render that turn's tool-result widgets in history — not just live.
 * Gated through the turn's conversation visibility (returns [] if no
 * access). Used by the historical tool-result renderer in the chat.
 */
export const forTurn = query({
  args: { turn_id: v.id("agent_turns") },
  handler: async (ctx, { turn_id }) => {
    const turn = await ctx.db.get(turn_id);
    if (!turn) return [];
    const access = await tryConversation(ctx, turn.conversation_id);
    if (!access) return [];
    return await ctx.db
      .query("agent_tool_events")
      .withIndex("by_turn_seq", (q) => q.eq("turn_id", turn_id))
      .order("asc")
      .collect();
  },
});
export const append = mutation({
  args: {
    turn_id: v.id("agent_turns"),
    write_token: v.string(),
    seq: v.number(),
    kind: v.union(
      v.literal("thought"),
      v.literal("tool_start"),
      v.literal("tool_end"),
      v.literal("tool_result"),
    ),
    tool_call_id: v.optional(v.string()),
    name: v.optional(v.string()),
    ok: v.optional(v.boolean()),
    delta: v.optional(v.string()),
    result_json: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { turn_id, write_token, seq, kind, tool_call_id, name, ok, delta, result_json },
  ) => {
    await assertWriteToken({ token: write_token, turnId: turn_id });
    await ctx.db.insert("agent_tool_events", {
      turn_id,
      seq,
      kind,
      tool_call_id,
      name,
      ok,
      delta,
      result_json,
      created_at: nowIso(),
    });
    const turn = await ctx.db.get(turn_id);
    if (turn && turn.status === "running") {
      await ctx.db.patch(turn_id, { last_heartbeat_at: nowIso() });
    }
  },
});
