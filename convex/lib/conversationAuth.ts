import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { authComponent } from "../auth";
import { isOperator } from "./assertOperator";

/**
 * Conversation visibility + ownership guards.
 *
 * Every direct-id query/mutation that reads or writes a conversation
 * (or any row keyed to one — messages, turns, chunks, tool events,
 * actions) MUST go through one of these helpers. Without that gate the
 * client can pass any `conversation_id` and bypass `listConversations`.
 *
 * Visibility model:
 *   - "personal" — only the `owner_user_id` may read/write.
 *   - "shared"   — any signed-in (and allowlisted-by-auth) operator
 *                  may read AND write.
 *
 * Legacy rows (created before this migration) have neither
 * `visibility` nor `owner_user_id`. We treat them as "personal" and
 * fall back to matching `actor_slug` against the caller's email-derived
 * slug — this preserves access for whoever was using the conversation
 * before the migration ran, until the backfill stamps an owner.
 */

function emailToSlug(email: string | undefined | null): string | null {
  if (!email) return null;
  const local = email.split("@")[0];
  if (!local) return null;
  return local.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
}

export type AuthUser = {
  _id: string;
  email?: string | null;
  slug: string | null;
};

/** Resolve the signed-in user. Throws if no session — every gated
 *  function requires identity. */
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<AuthUser> {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) throw new Error("unauthenticated");
  const u = user as { _id?: string; userId?: string; email?: string | null };
  const id = u._id ?? u.userId ?? null;
  if (!id) throw new Error("unauthenticated");
  return { _id: id, email: u.email, slug: emailToSlug(u.email) };
}

async function canAccess(
  ctx: QueryCtx | MutationCtx,
  conv: Doc<"agent_conversations">,
  user: AuthUser,
): Promise<boolean> {
  const visibility = conv.visibility ?? "personal";
  if (visibility === "shared") {
    const op = await isOperator(ctx);
    return op !== null;
  }
  if (conv.owner_user_id) return conv.owner_user_id === user._id;
  // Legacy fallback: no owner stamped yet — match by actor_slug
  // until claimMyUnownedConversations runs on sidebar mount.
  return !!user.slug && conv.actor_slug === user.slug;
}

/** Load a conversation by id and assert the caller can access it.
 *  Throws on missing / forbidden. */
export async function requireConversation(
  ctx: QueryCtx | MutationCtx,
  id: Id<"agent_conversations">,
): Promise<{ conv: Doc<"agent_conversations">; user: AuthUser }> {
  const user = await requireUser(ctx);
  const conv = await ctx.db.get(id);
  if (!conv) throw new Error("conversation not found");
  if (!(await canAccess(ctx, conv, user))) throw new Error("forbidden");
  return { conv, user };
}

/** Same as requireConversation but returns null instead of throwing on
 *  not-found / forbidden. Use in reactive queries where the client
 *  might transiently subscribe to a conversation it can't see (e.g.
 *  during a flip). */
export async function tryConversation(
  ctx: QueryCtx | MutationCtx,
  id: Id<"agent_conversations">,
): Promise<{ conv: Doc<"agent_conversations">; user: AuthUser } | null> {
  const user = await authComponent.safeGetAuthUser(ctx);
  if (!user) return null;
  const u = user as { _id?: string; userId?: string; email?: string | null };
  const userId = u._id ?? u.userId ?? null;
  if (!userId) return null;
  const conv = await ctx.db.get(id);
  if (!conv) return null;
  const authUser: AuthUser = {
    _id: userId,
    email: u.email,
    slug: emailToSlug(u.email),
  };
  if (!(await canAccess(ctx, conv, authUser))) return null;
  return { conv, user: authUser };
}

/** Build the Hermes session name for a new conversation. Personal
 *  chats are prefixed with the owner so two personal stores never
 *  overlap; shared chats live in a single shared namespace. */
export function hermesSessionName(
  visibility: "personal" | "shared",
  ownerUserId: string,
): string {
  const rand = Math.random().toString(36).slice(2, 8);
  if (visibility === "shared") return `castle-shared-${rand}`;
  // Use a short, stable owner suffix — first 8 chars of the user id —
  // so the session-store-on-disk file names stay readable.
  const ownerShort = ownerUserId.slice(0, 8);
  return `castle-personal-${ownerShort}-${rand}`;
}

export { emailToSlug };
