import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { assertWriteToken } from "./lib/writeToken";
import { nowIso } from "./lib/util";

/**
 * Agent turn lifecycle.
 *
 * One row per assistant turn. The Vercel route calls `startTurn` to
 * atomically create the user message + assistant placeholder + this
 * row; the Railway wrapper calls `claimQueued` to atomically promote
 * `queued → running`; then patches `heartbeat`, `complete`, `fail`, or
 * is told to bail via `cancel` from the route.
 *
 * Writes from the wrapper carry a per-turn writeToken (HMAC of turnId
 * with CASTLE_STREAM_SECRET) so a leaked secret can't be used to
 * scribble over arbitrary turns. Reads enforce caller actor_slug
 * matches conversation.actor_slug.
 */

const status = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("complete"),
  v.literal("failed"),
  v.literal("canceled"),
);

/**
 * Single atomic mutation that inserts the user message + assistant
 * placeholder + agent_turns row. Called by `/api/agent/start`.
 */
export const startTurn = mutation({
  args: {
    conversation_id: v.id("agent_conversations"),
    actor_slug: v.string(),
    user_text: v.string(),
    hermes_session: v.string(),
  },
  handler: async (ctx, args) => {
    const now = nowIso();
    const user_message_id = await ctx.db.insert("agent_messages", {
      conversation_id: args.conversation_id,
      actor_slug: args.actor_slug,
      role: "user",
      text: args.user_text,
      created_at: now,
    });
    const assistant_message_id = await ctx.db.insert("agent_messages", {
      conversation_id: args.conversation_id,
      actor_slug: args.actor_slug,
      role: "assistant",
      text: "",
      status: "streaming",
      created_at: now,
      updated_at: now,
    });
    const turn_id = await ctx.db.insert("agent_turns", {
      conversation_id: args.conversation_id,
      actor_slug: args.actor_slug,
      user_message_id,
      assistant_message_id,
      hermes_session: args.hermes_session,
      status: "queued",
      started_at: now,
      last_heartbeat_at: now,
    });
    // Wire the assistant placeholder back to the turn it belongs to so
    // the reactive query can hop from message → turn.
    await ctx.db.patch(assistant_message_id, { turn_id });
    // Bump the conversation so it floats to the top of the sidebar +
    // auto-title from the user's first message (mirrors the prior
    // append() behavior).
    const conv = await ctx.db.get(args.conversation_id);
    if (conv) {
      const patch: { updated_at: string; title?: string } = { updated_at: now };
      if (conv.title === "New chat") {
        patch.title = args.user_text.trim().slice(0, 48) || "New chat";
      }
      await ctx.db.patch(args.conversation_id, patch);
    }
    return { turn_id, user_message_id, assistant_message_id };
  },
});

/**
 * Atomic queued → running promotion. Rejects replays — if the row is
 * already past queued (running/complete/failed/canceled), the mutation
 * throws and the wrapper drops the duplicate kickoff.
 */
export const claimQueued = mutation({
  args: {
    turn_id: v.id("agent_turns"),
    write_token: v.string(),
  },
  handler: async (ctx, { turn_id, write_token }) => {
    await assertWriteToken({ token: write_token, turnId: turn_id });
    const turn = await ctx.db.get(turn_id);
    if (!turn) throw new Error("turn not found");
    if (turn.status !== "queued") {
      throw new Error(`turn already in status ${turn.status}; not claimable`);
    }
    const now = nowIso();
    await ctx.db.patch(turn_id, {
      status: "running",
      last_heartbeat_at: now,
    });
    return { ok: true };
  },
});

/** Wrapper heartbeats every 15s during quiet stretches. */
export const heartbeat = mutation({
  args: { turn_id: v.id("agent_turns"), write_token: v.string() },
  handler: async (ctx, { turn_id, write_token }) => {
    await assertWriteToken({ token: write_token, turnId: turn_id });
    const turn = await ctx.db.get(turn_id);
    if (!turn) return; // raced with sweep — ignore
    if (turn.status !== "running") return;
    await ctx.db.patch(turn_id, { last_heartbeat_at: nowIso() });
  },
});

/** Final state: success. Snapshots the assistant text. */
export const complete = mutation({
  args: {
    turn_id: v.id("agent_turns"),
    write_token: v.string(),
    final_text: v.string(),
    stop_reason: v.string(),
  },
  handler: async (ctx, { turn_id, write_token, final_text, stop_reason }) => {
    await assertWriteToken({ token: write_token, turnId: turn_id });
    const turn = await ctx.db.get(turn_id);
    if (!turn) throw new Error("turn not found");
    const now = nowIso();
    await ctx.db.patch(turn_id, {
      status: "complete",
      completed_at: now,
      stop_reason,
      last_heartbeat_at: now,
    });
    await ctx.db.patch(turn.assistant_message_id, {
      text: final_text,
      status: "complete",
      updated_at: now,
    });
  },
});

/** Final state: failure. */
export const fail = mutation({
  args: {
    turn_id: v.id("agent_turns"),
    write_token: v.string(),
    error: v.string(),
    partial_text: v.optional(v.string()),
  },
  handler: async (ctx, { turn_id, write_token, error, partial_text }) => {
    await assertWriteToken({ token: write_token, turnId: turn_id });
    const turn = await ctx.db.get(turn_id);
    if (!turn) throw new Error("turn not found");
    const now = nowIso();
    await ctx.db.patch(turn_id, {
      status: "failed",
      completed_at: now,
      error,
      last_heartbeat_at: now,
    });
    await ctx.db.patch(turn.assistant_message_id, {
      text: partial_text ?? "",
      status: "failed",
      updated_at: now,
    });
  },
});

/**
 * Vercel route writes this when the user clicks stop. The wrapper polls
 * for it and aborts its asyncio task. No write_token needed — this is
 * a server-only mutation called from the Vercel route (which is already
 * auth-gated by Better Auth middleware). Caller must pass actor_slug;
 * the mutation verifies it matches the turn's actor.
 */
export const cancel = mutation({
  args: {
    turn_id: v.id("agent_turns"),
    actor_slug: v.string(),
  },
  handler: async (ctx, { turn_id, actor_slug }) => {
    const turn = await ctx.db.get(turn_id);
    if (!turn) throw new Error("turn not found");
    if (turn.actor_slug !== actor_slug) {
      throw new Error("forbidden");
    }
    if (turn.status === "complete" || turn.status === "failed" || turn.status === "canceled") {
      return { ok: true, already: turn.status };
    }
    const now = nowIso();
    await ctx.db.patch(turn_id, {
      status: "canceled",
      completed_at: now,
      last_heartbeat_at: now,
    });
    await ctx.db.patch(turn.assistant_message_id, {
      status: "canceled",
      updated_at: now,
    });
    return { ok: true };
  },
});

/**
 * Vercel route uses this when Railway kickoff fails. Marks the just-
 * created queued turn as failed without needing a write_token (Vercel
 * is trusted; the route already authed the actor).
 */
export const failFromRoute = mutation({
  args: {
    turn_id: v.id("agent_turns"),
    actor_slug: v.string(),
    error: v.string(),
  },
  handler: async (ctx, { turn_id, actor_slug, error }) => {
    const turn = await ctx.db.get(turn_id);
    if (!turn) return;
    if (turn.actor_slug !== actor_slug) throw new Error("forbidden");
    if (turn.status !== "queued") return;
    const now = nowIso();
    await ctx.db.patch(turn_id, {
      status: "failed",
      completed_at: now,
      error,
      last_heartbeat_at: now,
    });
    await ctx.db.patch(turn.assistant_message_id, {
      status: "failed",
      updated_at: now,
    });
  },
});

/**
 * Reactive query: the active turn for a conversation (if any). Returns
 * the turn + its chunks + its tool events so the client gets one
 * subscription instead of three.
 *
 * Auth: caller's actor_slug must match the conversation's actor_slug.
 * Phase A: actor_slug is derived client-side (Better Auth email →
 * slug). The query accepts it as an arg and asserts the conversation
 * row matches. A more locked-down Phase B would use ctx.auth identity
 * directly.
 */
export const activeFor = query({
  args: {
    conversation_id: v.id("agent_conversations"),
    actor_slug: v.string(),
  },
  handler: async (ctx, { conversation_id, actor_slug }) => {
    const conv = await ctx.db.get(conversation_id);
    if (!conv) return null;
    if (conv.actor_slug !== actor_slug) {
      throw new Error("forbidden");
    }
    // Active = anything not yet complete/failed/canceled. There should
    // be at most one such turn per conversation (the wrapper's per-
    // session lock enforces it).
    const active = await ctx.db
      .query("agent_turns")
      .withIndex("by_conversation", (q) =>
        q.eq("conversation_id", conversation_id),
      )
      .order("desc")
      .first();
    if (
      !active ||
      active.status === "complete" ||
      active.status === "failed" ||
      active.status === "canceled"
    ) {
      return null;
    }
    const [chunks, events] = await Promise.all([
      ctx.db
        .query("agent_message_chunks")
        .withIndex("by_turn_seq", (q) => q.eq("turn_id", active._id))
        .collect(),
      ctx.db
        .query("agent_tool_events")
        .withIndex("by_turn_seq", (q) => q.eq("turn_id", active._id))
        .collect(),
    ]);
    return { turn: active, chunks, events };
  },
});

/**
 * Cron-driven sweep. Picks up stuck or never-started turns and marks
 * them failed. Two thresholds:
 *   - `queued` not promoted to running within 60s → failed
 *     ("never started")
 *   - `running` heartbeat stale for 90s → failed
 *     ("wrapper unresponsive")
 */
export const sweepStuck = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const STALE_QUEUED_MS = 60_000;
    const STALE_RUNNING_MS = 90_000;
    const candidates: Array<Doc<"agent_turns">> = await ctx.db
      .query("agent_turns")
      .withIndex("by_status_heartbeat")
      .filter((q) =>
        q.or(q.eq(q.field("status"), "queued"), q.eq(q.field("status"), "running")),
      )
      .collect();
    const failed: Array<Id<"agent_turns">> = [];
    for (const t of candidates) {
      const heartbeatMs = new Date(t.last_heartbeat_at).getTime();
      const age = now - heartbeatMs;
      const threshold =
        t.status === "queued" ? STALE_QUEUED_MS : STALE_RUNNING_MS;
      if (age <= threshold) continue;
      const reason =
        t.status === "queued" ? "never started" : "wrapper unresponsive";
      const nowIsoStr = new Date(now).toISOString();
      await ctx.db.patch(t._id, {
        status: "failed",
        completed_at: nowIsoStr,
        error: reason,
        last_heartbeat_at: nowIsoStr,
      });
      await ctx.db.patch(t.assistant_message_id, {
        status: "failed",
        updated_at: nowIsoStr,
      });
      failed.push(t._id);
    }
    return { failed };
  },
});
