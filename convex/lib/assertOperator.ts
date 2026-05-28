import type { MutationCtx, QueryCtx } from "../_generated/server";
import { authComponent } from "../auth";
import { isEmailAllowedAgainst } from "../../lib/auth-allowlist";

export async function isOperator(
  ctx: QueryCtx | MutationCtx,
): Promise<string | null> {
  const me = await authComponent.safeGetAuthUser(ctx);
  let email = me?.email;
  if (!email) {
    // No Better Auth session — fall back to the raw Convex identity.
    // This is how admin-auth callers (deploy key + actingAs identity)
    // authenticate, e.g. castle-mcp running on Railway. The allowlist
    // check still applies, so a deploy-key holder can only impersonate
    // identities whose email is on the allowlist.
    const identity = await ctx.auth.getUserIdentity();
    email = identity?.email;
  }
  if (!email) return null;
  const dynamic = (await ctx.db.query("email_allowlist").collect()).map(
    (r) => r.pattern,
  );
  return isEmailAllowedAgainst(email, dynamic) ? email : null;
}

export async function assertOperator(ctx: MutationCtx): Promise<{ email: string }> {
  const email = await isOperator(ctx);
  if (!email) throw new Error("unauthorized: sign in as an allowlisted operator");
  return { email };
}

export async function assertOperatorRead(
  ctx: QueryCtx,
): Promise<{ email: string }> {
  const email = await isOperator(ctx);
  if (!email) throw new Error("unauthorized: sign in as an allowlisted operator");
  return { email };
}
