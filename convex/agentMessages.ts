import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { nowIso } from "./lib/util";
import { assertWriteToken } from "./lib/writeToken";
import {
  hermesSessionName,
  requireConversation,
  requireUser,
  tryConversation,
} from "./lib/conversationAuth";

const role = v.union(v.literal("user"), v.literal("assistant"));
const visibilityArg = v.union(v.literal("personal"), v.literal("shared"));

/** One-off: wipe legacy rows from before conversation_id existed. Safe
 *  to call repeatedly; deletes any row without a conversation_id field
 *  set. Used by a startup migration; not exposed in the UI. */
export const wipeLegacy = mutation({
  args: {},
  handler: async (ctx) => {
    let removed = 0;
    for await (const row of ctx.db.query("agent_messages")) {
      const r = row as unknown as { conversation_id?: string };
      if (!r.conversation_id) {
        await ctx.db.delete(row._id);
        removed++;
      }
    }
    return removed;
  },
});

// ─────────────────────────── conversations ───────────────────────────

/** Legacy: still here so the Vercel `/api/agent/start` route can look
 *  up `hermes_session` server-side without a separate query. Returns
 *  only conversations the caller can see (personal-owned + all shared).
 *  Reactive UI uses `listPersonal` + `listShared` below. */
export const listConversations = query({
  args: { actor_slug: v.optional(v.string()) },
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const personal = await ctx.db
      .query("agent_conversations")
      .withIndex("by_owner_updated", (q) => q.eq("owner_user_id", user._id))
      .order("desc")
      .collect();
    const shared = await ctx.db
      .query("agent_conversations")
      .withIndex("by_visibility_updated", (q) => q.eq("visibility", "shared"))
      .order("desc")
      .collect();
    const seen = new Set<string>();
    const out = [] as typeof personal;
    for (const r of [...personal, ...shared]) {
      if (seen.has(r._id)) continue;
      seen.add(r._id);
      out.push(r);
    }
    out.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    return out;
  },
});

export const listPersonal = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    // Owner-only listing. Legacy unowned rows are intentionally dropped
    // here — the sidebar's opportunistic `claimMyUnownedConversations`
    // mutation runs on mount and stamps `owner_user_id` for any row
    // whose `actor_slug` matches the caller's slug. The reactive query
    // then re-runs and the rows pop in. This avoids a same-local-part
    // collision where two operators (`sam@a.com`, `sam@b.com`) would
    // briefly see each other's pre-migration chats in their list.
    const owned = await ctx.db
      .query("agent_conversations")
      .withIndex("by_owner_updated", (q) => q.eq("owner_user_id", user._id))
      .order("desc")
      .collect();
    return owned.filter((r) => (r.visibility ?? "personal") === "personal");
  },
});

export const listShared = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return ctx.db
      .query("agent_conversations")
      .withIndex("by_visibility_updated", (q) => q.eq("visibility", "shared"))
      .order("desc")
      .collect();
  },
});

export const createConversation = mutation({
  args: {
    title: v.optional(v.string()),
    visibility: v.optional(visibilityArg),
  },
  handler: async (ctx, { title, visibility }) => {
    const user = await requireUser(ctx);
    const now = nowIso();
    const vis = visibility ?? "personal";
    const session = hermesSessionName(vis, user._id);
    return ctx.db.insert("agent_conversations", {
      // Keep actor_slug populated for legacy readers (Castle MCP on
      // Railway still keys agent_actions, etc. by slug).
      actor_slug: user.slug ?? "anon",
      title: title?.trim() || "New chat",
      hermes_session: session,
      visibility: vis,
      owner_user_id: user._id,
      created_at: now,
      updated_at: now,
    });
  },
});

/**
 * Bind an ACP-minted session id back to a Castle conversation. Called
 * by the Hermes wrapper the first time it mints a fresh session for an
 * existing conversation (e.g. after the stored name fails to load).
 * Subsequent turns reuse the bound id, so memory accumulates instead of
 * resetting on every turn.
 *
 * Auth: per-turn HMAC `write_token` (same scheme as `agentTurns.*`),
 * plus the turn must belong to this conversation. Without these the
 * mutation is publicly callable by any signed-in user — they could
 * rewrite another conversation's memory pointer.
 *
 * Race safety: `expected_hermes_session` is the value the wrapper
 * loaded at the start of the turn. If the row's current value differs
 * (e.g. an operator flipped visibility mid-turn and `setVisibility`
 * already re-minted), the patch is skipped — we do NOT clobber a fresh
 * shared/personal session with the old turn's minted id.
 */
export const bindSession = mutation({
  args: {
    id: v.id("agent_conversations"),
    turn_id: v.id("agent_turns"),
    write_token: v.string(),
    hermes_session: v.string(),
    expected_hermes_session: v.string(),
  },
  handler: async (
    ctx,
    { id, turn_id, write_token, hermes_session, expected_hermes_session },
  ) => {
    await assertWriteToken({ token: write_token, turnId: turn_id });
    const turn = await ctx.db.get(turn_id);
    if (!turn) throw new Error("turn not found");
    if (turn.conversation_id !== id) {
      throw new Error("turn does not belong to this conversation");
    }
    const conv = await ctx.db.get(id);
    if (!conv) throw new Error("conversation not found");
    if (conv.hermes_session !== expected_hermes_session) {
      // The conversation has been re-minted (likely a visibility flip)
      // since this turn started. Drop the bind — the new session is
      // authoritative.
      return { skipped: true as const, reason: "session changed" };
    }
    await ctx.db.patch(id, { hermes_session, updated_at: nowIso() });
    return { skipped: false as const };
  },
});

export const renameConversation = mutation({
  args: { id: v.id("agent_conversations"), title: v.string() },
  handler: async (ctx, { id, title }) => {
    await requireConversation(ctx, id);
    await ctx.db.patch(id, {
      title: title.trim() || "Untitled",
      updated_at: nowIso(),
    });
  },
});

export const deleteConversation = mutation({
  args: { id: v.id("agent_conversations") },
  handler: async (ctx, { id }) => {
    const { conv, user } = await requireConversation(ctx, id);
    // Extra guard for shared chats: only the original owner may delete,
    // even though any operator can read/write. Anyone can demote it to
    // personal first if they want to delete — that's an intentional
    // step.
    if ((conv.visibility ?? "personal") === "shared") {
      if (conv.owner_user_id && conv.owner_user_id !== user._id) {
        throw new Error("only the original owner may delete a shared chat");
      }
    }
    const msgs = await ctx.db
      .query("agent_messages")
      .withIndex("by_conversation_time", (q) => q.eq("conversation_id", id))
      .collect();
    for (const m of msgs) await ctx.db.delete(m._id);
    await ctx.db.delete(id);
  },
});

/** Flip personal ↔ shared. Re-mints `hermes_session` so the two memory
 *  stores never bleed together. Only the owner may flip; flipping a
 *  shared chat back to personal sets the caller as owner. */
export const setVisibility = mutation({
  args: {
    id: v.id("agent_conversations"),
    visibility: visibilityArg,
  },
  handler: async (ctx, { id, visibility }) => {
    const { conv, user } = await requireConversation(ctx, id);
    if (conv.visibility === visibility) return;
    // Only the owner can change visibility on a personal chat. For a
    // shared chat, any operator can demote it back to personal — they
    // then become the owner of the new personal copy.
    const isShared = (conv.visibility ?? "personal") === "shared";
    if (!isShared && conv.owner_user_id && conv.owner_user_id !== user._id) {
      throw new Error("only the owner may share or unshare this chat");
    }

    // Reject visibility flips while a turn is active
    const activeTurns = await ctx.db
      .query("agent_turns")
      .withIndex("by_conversation", (q) => q.eq("conversation_id", id))
      .order("desc")
      .collect();
    const activeNow = activeTurns.find(
      (t) =>
        t.status === "queued" ||
        t.status === "running",
    );
    if (activeNow) {
      throw new Error(
        "cannot change visibility while a turn is active; cancel or wait for it to finish",
      );
    }

    const newOwner =
      visibility === "personal" ? user._id : (conv.owner_user_id ?? user._id);
    const newSession = hermesSessionName(visibility, newOwner);
    await ctx.db.patch(id, {
      visibility,
      owner_user_id: newOwner,
      hermes_session: newSession,
      updated_at: nowIso(),
    });
  },
});

// ─────────────────────────── messages ───────────────────────────

export const list = query({
  args: {
    conversation_id: v.id("agent_conversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { conversation_id, limit }) => {
    // Reactive query: return [] (not throw) when the caller can't see
    // the conversation. The sidebar query filter will drop the entry
    // anyway; throwing would surface as a runtime error in the chat
    // shell during a visibility flip.
    const access = await tryConversation(ctx, conversation_id);
    if (!access) return [];
    const rows = await ctx.db
      .query("agent_messages")
      .withIndex("by_conversation_time", (q) =>
        q.eq("conversation_id", conversation_id),
      )
      .order("asc")
      .collect();
    const cap = limit ?? 200;
    return rows.slice(-cap);
  },
});

const attachmentArg = v.object({
  storageId: v.id("_storage"),
  name: v.string(),
  contentType: v.optional(v.string()),
  size: v.optional(v.number()),
});

export const append = mutation({
  args: {
    conversation_id: v.id("agent_conversations"),
    role,
    text: v.string(),
    attachments: v.optional(v.array(attachmentArg)),
  },
  handler: async (ctx, { conversation_id, role: r, text, attachments }) => {
    const { conv, user } = await requireConversation(ctx, conversation_id);
    const now = nowIso();
    const id = await ctx.db.insert("agent_messages", {
      conversation_id,
      actor_slug: user.slug ?? conv.actor_slug,
      role: r,
      text,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
      created_at: now,
    });
    const patch: Partial<typeof conv> = { updated_at: now };
    if (r === "user" && conv.title === "New chat") {
      patch.title = text.trim().slice(0, 48) || "New chat";
    }
    await ctx.db.patch(conversation_id, patch);
    return id;
  },
});

/** Convex storage upload URL. Operator-only (any signed-in user is
 *  fine — middleware already gates the dashboard). The client POSTs
 *  the file binary to this URL, then passes the returned storageId in
 *  the `attachments` array on `startTurn`/`append`. */
export const generateAttachmentUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Resolve a storage id to a (signed) URL — used by the chat renderer
 *  to display attachment chips with click-to-download links. Returns
 *  null for missing/expired ids. Requires the caller to pass the
 *  conversation_id so we can re-check access before minting the URL. */
export const attachmentUrl = query({
  args: {
    storageId: v.id("_storage"),
    conversation_id: v.id("agent_conversations"),
  },
  handler: async (ctx, { storageId, conversation_id }) => {
    await requireConversation(ctx, conversation_id);
    return await ctx.storage.getUrl(storageId);
  },
});

/** Clear the visible transcript for a conversation. Does NOT touch
 *  Hermes' underlying session — that's its own memory store. */
export const clear = mutation({
  args: { conversation_id: v.id("agent_conversations") },
  handler: async (ctx, { conversation_id }) => {
    await requireConversation(ctx, conversation_id);
    const rows = await ctx.db
      .query("agent_messages")
      .withIndex("by_conversation_time", (q) =>
        q.eq("conversation_id", conversation_id),
      )
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  },
});
