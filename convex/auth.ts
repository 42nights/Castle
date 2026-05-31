import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { createClient, GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components, internal } from "./_generated/api";
import { internalAction, mutation, query } from "./_generated/server";
import { DataModel } from "./_generated/dataModel";
import { v } from "convex/values";
import authConfig from "./auth.config";
import { isEmailAllowedAgainst } from "../lib/auth-allowlist";

/**
 * Castle auth — Better Auth with the Convex component backing it.
 * GitHub OAuth only. No email/password, no magic link, no anonymous.
 * Sessions and users live in the betterAuth component's tables; FDE
 * rows in our own schema get linked by Better Auth user id.
 */

export const authComponent = createClient<DataModel>(components.betterAuth);

/**
 * Read dynamic allowlist patterns from Convex. The hardcoded rescue
 * patterns in lib/auth-allowlist.ts are merged inside
 * `isEmailAllowedAgainst`, so if this query fails we still let
 * rescue-listed addresses through.
 */
async function readPatterns(
  ctx: Parameters<typeof createAuth>[0],
): Promise<string[]> {
  try {
    return (await ctx.runQuery(
      internal.emailAllowlist.patternsForCheck,
      {},
    )) as string[];
  } catch {
    return [];
  }
}

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    // Read env at function-call time, not module-top, so Convex
    // reliably has the value populated before Better Auth looks it up.
    baseURL: process.env.SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    account: {
      accountLinking: {
        enabled: true,
        allowDifferentEmails: true,
      },
    },
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID as string,
        clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      },
    },
    // Server-side allowlist. Better Auth invokes `user.create.before`
    // after the OAuth callback but before persisting a row — throwing
    // here cancels the sign-in and the client sees an error.
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const email = (user as { email?: string }).email;
            const patterns = await readPatterns(ctx);
            if (!isEmailAllowedAgainst(email, patterns)) {
              // Log non-allowlisted sign-ins so /settings/access can
              // surface them. Operators can approve (promote to operator)
              // or dismiss. Guest users are allowed through.
              if (email && "runMutation" in ctx) {
                try {
                  await ctx.runMutation(
                    internal.emailAllowlist.logDenied,
                    { email },
                  );
                } catch (err) {
                  console.error("[auth] logDenied failed:", err);
                }
              }
            }
            return { data: user };
          },
        },
      },
    },
    plugins: [convex({ authConfig })],
  } satisfies BetterAuthOptions);

export const { getAuthUser } = authComponent.clientApi();

/**
 * Derive an FDE slug from a user's email. Checks KNOWN_SLUG_MAP first,
 * then falls back to the email local-part with non-alnum chars replaced.
 * This map covers cases where the FDE slug differs from the email local-part.
 */
const KNOWN_SLUG_MAP: Record<string, string> = {
  "jerry.x0930@gmail.com": "jerry",
};

/** User object with operator/guest role + linked FDE info.
 *  Returns null when not signed in (no session). Re-checks the allowlist
 *  on every read so that removing a pattern immediately downgrades to guest.
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    const patterns = (await ctx.db
      .query("email_allowlist")
      .collect()).map((r) => r.pattern);
    const isOperator = isEmailAllowedAgainst(user.email, patterns);

    // Resolve FDE slug: check known map first, then email local-part
    const email = user.email?.trim().toLowerCase() ?? "";
    const fde_slug =
      KNOWN_SLUG_MAP[email] ??
      (email.split("@")[0]?.replace(/[^a-z0-9._-]/g, "-") || null);

    // Try to find linked FDE by slug
    let linked_fde_id: string | null = null;
    if (fde_slug) {
      const fde = await ctx.db
        .query("fdes")
        .withIndex("by_slug", (q) => q.eq("slug", fde_slug))
        .first();
      if (fde) linked_fde_id = fde._id;
    }

    return { ...user, isOperator, fde_slug, linked_fde_id };
  },
});

/** Manually link a Better Auth user to an FDE row. Operator-only. */
export const linkFdeToUser = mutation({
  args: {
    fde_slug: v.string(),
    target_email: v.string(),
  },
  handler: async (ctx, { fde_slug, target_email }) => {
    // Verify caller is operator (reuse the allowlist check pattern)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("unauthorized");
    const fde = await ctx.db
      .query("fdes")
      .withIndex("by_slug", (q) => q.eq("slug", fde_slug))
      .first();
    if (!fde) throw new Error(`FDE with slug "${fde_slug}" not found`);
    // The mapping is stored in the KNOWN_SLUG_MAP server-side; this
    // mutation is here for the operator UI and future backfill scripts.
    // The actual runtime link is resolved in getCurrentUser above.
    return { fde_id: fde._id, fde_slug, target_email };
  },
});

/** Rotate Better Auth signing keys — call manually via `npx convex run
 *  auth:rotateKeys` if a key leak is suspected. */
export const rotateKeys = internalAction({
  args: {},
  handler: async (ctx) => {
    const auth = createAuth(ctx);
    return auth.api.rotateKeys();
  },
});
