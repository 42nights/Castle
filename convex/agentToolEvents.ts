import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { assertWriteToken } from "./lib/writeToken";
import { nowIso } from "./lib/util";

/**
 * Append-only tool / thought events during streaming. Listing is
 * folded into `agentTurns.activeFor`.
 */
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
