import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { authComponent } from "../auth";
import { isEmailAllowedAgainst } from "../../lib/auth-allowlist";

/** True when P33 multi-tenant isolation is active. Default OFF. */
export const MULTITENANT_ON = process.env.CASTLE_MULTITENANT === "1";

/** The slug used for the single-tenant default org backfilled in migration. */
export const DEFAULT_ORG_SLUG = "42nights-default";

/**
 * Resolve the calling user's organization id.
 *
 * - Flag OFF → null (caller gets unfiltered data, same as today).
 * - Flag ON  → look up organization_members by user_id. Falls through
 *              to the default org if the user has no membership row (so
 *              pre-migration users still see data after backfill).
 */
export async function resolveOrgId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"organizations"> | null> {
  if (!MULTITENANT_ON) return null;

  // Resolve the caller's Better Auth user id. Mirror the two paths
  // in assertOperator: admin-auth (no sessionId) and normal web-user.
  const identity = await ctx.auth.getUserIdentity();
  let userId: string | null = null;

  if (identity && !identity.sessionId && identity.email) {
    // Admin-auth path (MCP deploy key). Check allowlist then use email as key.
    const dynamic = (await ctx.db.query("email_allowlist").collect()).map(
      (r) => r.pattern,
    );
    if (!isEmailAllowedAgainst(identity.email, dynamic)) return null;
    userId = identity.email;
  } else {
    const me = await authComponent.safeGetAuthUser(ctx);
    if (!me?._id) return null;
    userId = me._id;
  }

  // Look up membership.
  const membership = await ctx.db
    .query("organization_members")
    .withIndex("by_user", (q) => q.eq("user_id", userId!))
    .first();

  if (membership) return membership.organization_id;

  // No membership → fall back to the default org so backfilled data stays visible.
  return defaultOrgId(ctx);
}

/** Fetch the id of the "42nights-default" org, or null if it doesn't exist yet. */
export async function defaultOrgId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"organizations"> | null> {
  const row = await ctx.db
    .query("organizations")
    .withIndex("by_slug", (q) => q.eq("slug", DEFAULT_ORG_SLUG))
    .first();
  return row?._id ?? null;
}

type WithOptionalOrgId = { organization_id?: Id<"organizations"> };

/**
 * Filter rows to the given org.
 *
 * - orgId null (flag OFF) → return ALL rows unchanged (zero behavioral change).
 * - orgId set → keep rows whose organization_id matches, plus rows with no
 *   organization_id at all (legacy/backfill-pending rows belong to the default
 *   org and stay visible to it).
 */
export function scopeToOrg<T extends WithOptionalOrgId>(
  rows: T[],
  orgId: Id<"organizations"> | null,
): T[] {
  if (orgId === null) return rows;
  return rows.filter(
    (r) => r.organization_id === orgId || r.organization_id === undefined,
  );
}
