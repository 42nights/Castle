import type { MutationCtx, QueryCtx } from "../_generated/server";
import { authComponent } from "../auth";
import { isEmailAllowedAgainst } from "../../lib/auth-allowlist";

export async function isOperator(
  ctx: QueryCtx | MutationCtx,
): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();

  // Admin-auth path (deploy key + actingAs identity) — e.g. castle-mcp
  // running on Railway. These identities don't carry a Better Auth
  // `sessionId`, and calling safeGetAuthUser with a missing sessionId
  // makes Better Auth's adapter ArgumentValidationError on `value:
  // undefined`. Short-circuit: trust the impersonated email after the
  // same allowlist check the web-user path uses.
  if (identity && !identity.sessionId && identity.email) {
    const dynamic = (await ctx.db.query("email_allowlist").collect()).map(
      (r) => r.pattern,
    );
    return isEmailAllowedAgainst(identity.email, dynamic) ? identity.email : null;
  }

  // Normal Better Auth web-user path.
  const me = await authComponent.safeGetAuthUser(ctx);
  const email = me?.email;
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
