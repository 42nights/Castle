import { mutation } from "./_generated/server";
import { authComponent } from "./auth";
import { isEmailAllowedAgainst } from "../lib/auth-allowlist";
import { requireUser } from "./lib/conversationAuth";

/**
 * One-shot conversation visibility/ownership backfill.
 *
 * Strategy:
 *   1. `stampDefaultsForConversations` — idempotent operator-gated
 *      mutation that sets `visibility = "personal"` on every row
 *      missing it. Safe to run multiple times; no-op once rows are
 *      stamped. Doesn't touch `owner_user_id` because we can't
 *      reliably reverse-resolve a Better Auth user from `actor_slug`
 *      server-side (no index by email local-part, and a slug can
 *      collide across providers).
 *
 *   2. `claimMyUnownedConversations` — user-facing mutation. Stamps
 *      `owner_user_id = caller` on any legacy row where `actor_slug`
 *      matches the caller's email-derived slug AND the row is unowned.
 *      Idempotent. The chat sidebar can call this opportunistically the
 *      first time a signed-in user loads their list, or operators can
 *      trigger it manually.
 *
 * Recovery: until the row is claimed,
 * `canAccess` returns false for every unowned personal row (no
 * actor_slug fallback — that fallback was removed to prevent
 * same-local-part operators from reading each other's pre-migration
 * chats). The sidebar mounts `claimMyUnownedConversations` on first
 * render and the reactive query then re-runs to show the rows. If an
 * operator deep-links to a conversation before the sidebar has had a
 * chance to claim (rare; sidebar is on `/`), they will see a "not
 * found" until they hit `/` once.
 *
 * Run from CLI:
 *   npx convex run migrations:stampDefaultsForConversations
 */
export const stampDefaultsForConversations = mutation({
  args: {},
  handler: async (ctx) => {
    // Operator gate: only allowlisted users may run the backfill,
    // since it touches every row. Mirrors the convention in
    // convex/emailAllowlist.ts.
    const me = await authComponent.safeGetAuthUser(ctx);
    const email = me?.email;
    if (!email) throw new Error("unauthenticated");
    const patterns = (await ctx.db.query("email_allowlist").collect()).map(
      (r) => r.pattern,
    );
    if (!isEmailAllowedAgainst(email, patterns)) {
      throw new Error("unauthorized: must be an allowlisted operator");
    }
    let stamped = 0;
    for await (const row of ctx.db.query("agent_conversations")) {
      if (row.visibility) continue;
      await ctx.db.patch(row._id, { visibility: "personal" });
      stamped++;
    }
    return { stamped };
  },
});

export const claimMyUnownedConversations = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user.slug) return { claimed: 0 };
    const rows = await ctx.db
      .query("agent_conversations")
      .withIndex("by_actor_updated", (q) => q.eq("actor_slug", user.slug!))
      .collect();
    let claimed = 0;
    for (const row of rows) {
      if (row.owner_user_id) continue;
      // Only claim personal-or-unset rows. Don't snatch ownership of a
      // pre-existing shared row.
      if ((row.visibility ?? "personal") !== "personal") continue;
      await ctx.db.patch(row._id, {
        owner_user_id: user._id,
        visibility: "personal",
      });
      claimed++;
    }
    return { claimed };
  },
});
