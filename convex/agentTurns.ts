import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { assertWriteToken } from "./lib/writeToken";
import { nowIso } from "./lib/util";
import { requireConversation, tryConversation } from "./lib/conversationAuth";

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
    user_text: v.string(),
    attachments: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          name: v.string(),
          contentType: v.optional(v.string()),
          size: v.optional(v.number()),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    // Owner / shared check + identity. The caller (Vercel route) must
    // forward Better Auth identity via fetchAuthMutation — we don't
    // trust a client-passed actor_slug anymore.
    const { conv, user } = await requireConversation(ctx, args.conversation_id);
    const actorSlug = user.slug ?? conv.actor_slug;
    const now = nowIso();
    const user_message_id = await ctx.db.insert("agent_messages", {
      conversation_id: args.conversation_id,
      actor_slug: actorSlug,
      role: "user",
      text: args.user_text,
      ...(args.attachments && args.attachments.length > 0
        ? { attachments: args.attachments }
        : {}),
      created_at: now,
    });
    const assistant_message_id = await ctx.db.insert("agent_messages", {
      conversation_id: args.conversation_id,
      actor_slug: actorSlug,
      role: "assistant",
      text: "",
      status: "streaming",
      created_at: now,
      updated_at: now,
    });
    const turn_id = await ctx.db.insert("agent_turns", {
      conversation_id: args.conversation_id,
      actor_slug: actorSlug,
      user_message_id,
      assistant_message_id,
      hermes_session: conv.hermes_session,
      status: "queued",
      started_at: now,
      last_heartbeat_at: now,
    });
    // Wire the assistant placeholder back to the turn it belongs to so
    // the reactive query can hop from message → turn.
    await ctx.db.patch(assistant_message_id, { turn_id });
    const patch: { updated_at: string; title?: string } = { updated_at: now };
    if (conv.title === "New chat") {
      patch.title = args.user_text.trim().slice(0, 48) || "New chat";
    }
    await ctx.db.patch(args.conversation_id, patch);
    // Resolve attachment URLs once for the route to forward to Hermes.
    // The route can't call storage.getUrl itself without another Convex
    // round-trip per file; doing it here keeps the kickoff cheap.
    const attachment_links: Array<{
      name: string;
      url: string;
      contentType?: string;
    }> = [];
    if (args.attachments) {
      for (const a of args.attachments) {
        const url = await ctx.storage.getUrl(a.storageId);
        if (url) {
          attachment_links.push({
            name: a.name,
            url,
            contentType: a.contentType,
          });
        }
      }
    }
    return {
      turn_id,
      user_message_id,
      assistant_message_id,
      hermes_session: conv.hermes_session,
      visibility: conv.visibility ?? "personal",
      actor_slug: actorSlug,
      attachment_links,
    };
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
 * for it and aborts its asyncio task. No write_token — the route uses
 * `fetchAuthMutation` so Convex sees the Better Auth user identity, and
 * we re-verify ownership against the turn's conversation.
 */
export const cancel = mutation({
  args: {
    turn_id: v.id("agent_turns"),
  },
  handler: async (ctx, { turn_id }) => {
    const turn = await ctx.db.get(turn_id);
    if (!turn) throw new Error("turn not found");
    await requireConversation(ctx, turn.conversation_id);
    if (
      turn.status === "complete" ||
      turn.status === "failed" ||
      turn.status === "canceled"
    ) {
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
 * created queued turn as failed. Re-verifies ownership against the
 * turn's conversation via the forwarded Better Auth identity.
 */
export const failFromRoute = mutation({
  args: {
    turn_id: v.id("agent_turns"),
    error: v.string(),
  },
  handler: async (ctx, { turn_id, error }) => {
    const turn = await ctx.db.get(turn_id);
    if (!turn) return;
    await requireConversation(ctx, turn.conversation_id);
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
 * Regenerate the latest assistant turn. Used by the chat UI's
 * "regenerate" button on the last assistant message.
 *
 * Behavior: finds the most recent terminal (complete/failed/canceled)
 * turn for the conversation, deletes its assistant_message + the turn
 * row + any chunks/tool events, then creates a new queued turn that
 * reuses the same user_message (and the conversation's current
 * hermes_session so the agent has the same context).
 *
 * Refuses if a turn is currently active. Caller must be able to access
 * the conversation.
 */
export const regenerateLast = mutation({
  args: {
    conversation_id: v.id("agent_conversations"),
  },
  handler: async (ctx, { conversation_id }) => {
    const { conv, user } = await requireConversation(ctx, conversation_id);
    const turns = await ctx.db
      .query("agent_turns")
      .withIndex("by_conversation", (q) =>
        q.eq("conversation_id", conversation_id),
      )
      .order("desc")
      .collect();
    if (turns.length === 0) throw new Error("no turn to regenerate");
    const latest = turns[0];
    if (latest.status === "queued" || latest.status === "running") {
      throw new Error("a turn is already running; cancel it first");
    }
    // Delete chunks + tool events + the assistant message for this turn.
    const chunks = await ctx.db
      .query("agent_message_chunks")
      .withIndex("by_turn_seq", (q) => q.eq("turn_id", latest._id))
      .collect();
    for (const c of chunks) await ctx.db.delete(c._id);
    const events = await ctx.db
      .query("agent_tool_events")
      .withIndex("by_turn_seq", (q) => q.eq("turn_id", latest._id))
      .collect();
    for (const e of events) await ctx.db.delete(e._id);
    await ctx.db.delete(latest.assistant_message_id);
    await ctx.db.delete(latest._id);
    // Re-create a fresh assistant placeholder + queued turn pointing at
    // the original user message. Reuses the conversation's current
    // hermes_session so the agent re-runs against the same memory.
    const now = nowIso();
    const newAssistantId = await ctx.db.insert("agent_messages", {
      conversation_id,
      actor_slug: user.slug ?? conv.actor_slug,
      role: "assistant",
      text: "",
      status: "streaming",
      created_at: now,
      updated_at: now,
    });
    const newTurnId = await ctx.db.insert("agent_turns", {
      conversation_id,
      actor_slug: user.slug ?? conv.actor_slug,
      user_message_id: latest.user_message_id,
      assistant_message_id: newAssistantId,
      hermes_session: conv.hermes_session,
      status: "queued",
      started_at: now,
      last_heartbeat_at: now,
    });
    await ctx.db.patch(newAssistantId, { turn_id: newTurnId });
    // Fetch the original user message text + attachments for the
    // route to forward to Hermes (mirrors what `/api/agent/start`
    // passes via attachment_links). Without this, regenerating a
    // turn whose user message had files attached would re-prompt
    // Hermes with text only — and an attachments-only turn would
    // degrade into an empty re-run.
    const userMsg = await ctx.db.get(latest.user_message_id);
    const attachment_links: Array<{
      name: string;
      url: string;
      contentType?: string;
    }> = [];
    for (const a of userMsg?.attachments ?? []) {
      const url = await ctx.storage.getUrl(a.storageId);
      if (url) {
        attachment_links.push({
          name: a.name,
          url,
          contentType: a.contentType,
        });
      }
    }
    return {
      turn_id: newTurnId,
      user_message_id: latest.user_message_id,
      assistant_message_id: newAssistantId,
      hermes_session: conv.hermes_session,
      visibility: conv.visibility ?? "personal",
      actor_slug: user.slug ?? conv.actor_slug,
      user_text: userMsg?.text ?? "",
      attachment_links,
    };
  },
});

/**
 * Reactive query: the active turn for a conversation (if any). Returns
 * the turn + its chunks + its tool events so the client gets one
 * subscription instead of three.
 *
 * Auth: caller must be authenticated and able to access the
 * conversation (owner for personal, any operator for shared). Returns
 * null (not throws) on missing / forbidden so a transient
 * mid-visibility-flip subscription doesn't surface as an error.
 */
export const activeFor = query({
  args: {
    conversation_id: v.id("agent_conversations"),
  },
  handler: async (ctx, { conversation_id }) => {
    const access = await tryConversation(ctx, conversation_id);
    if (!access) return null;
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
        q.or(
          q.eq(q.field("status"), "queued"),
          q.eq(q.field("status"), "running"),
        ),
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
