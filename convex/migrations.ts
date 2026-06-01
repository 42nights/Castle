import { mutation } from "./_generated/server";
import { authComponent } from "./auth";
import { isEmailAllowedAgainst } from "../lib/auth-allowlist";
import { requireUser } from "./lib/conversationAuth";
import { nowIso } from "./lib/util";
import { DEFAULT_ORG_SLUG } from "./lib/org";
import { isOperator } from "./lib/assertOperator";

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
 * Until a row is claimed, the access check in
 * `convex/lib/conversationAuth.ts` falls back to matching
 * `actor_slug → caller.slug`, so existing chats remain accessible to
 * their original users mid-migration.
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

/**
 * P33 backfill — idempotent, safe to re-run.
 *
 * 1. Creates the "42nights-default" organization if it doesn't exist.
 * 2. Stamps every operational row that's missing organization_id with the
 *    default org id.
 * 3. Creates organization_members rows for every existing Better Auth user
 *    who is on the email allowlist (the operator set).
 *
 * Run from CLI:
 *   npx convex run migrations:stampDefaultOrg
 */
export const stampDefaultOrg = mutation({
  args: {},
  handler: async (ctx) => {
    // Operator gate — mirrors assertOperator but as mutation-safe version
    const email = await isOperator(ctx);
    if (!email) throw new Error("unauthorized: must be an allowlisted operator");

    const now = nowIso();

    // 1. Ensure the default org exists.
    let defaultOrg = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", DEFAULT_ORG_SLUG))
      .first();
    if (!defaultOrg) {
      const orgId = await ctx.db.insert("organizations", {
        name: "42nights",
        slug: DEFAULT_ORG_SLUG,
        created_at: now,
      });
      defaultOrg = (await ctx.db.get(orgId))!;
    }
    const orgId = defaultOrg._id;

    // 2. Stamp operational tables. Skip rows that already have organization_id.
    const tables = [
      "fdes",
      "customers",
      "engagements",
      "deployments",
      "templates",
      "pattern_extractions",
      "founder_hours",
      "email_allowlist",
    ] as const;

    let stamped = 0;
    for (const table of tables) {
      for await (const row of ctx.db.query(table)) {
        if (row.organization_id) continue;
        await ctx.db.patch(row._id, { organization_id: orgId });
        stamped++;
      }
    }

    // 3. Organization members for Better Auth users are created lazily: on
    // first request resolveOrgId falls back to the default org for users
    // with no membership row. Use organizations.addMember or
    // organizations.createOrgWithMembers to explicitly assign users after
    // this migration runs.
    const membersAdded = 0;

    return { orgId, stamped, membersAdded };
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
