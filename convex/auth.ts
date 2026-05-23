import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { createClient, GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components, internal } from "./_generated/api";
import { internalAction, query } from "./_generated/server";
import { DataModel } from "./_generated/dataModel";
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
              // Best-effort log so /settings/access can surface the
              // exact email GitHub returned. Wrap in try/catch — a
              // logging failure must not mask the access_denied error.
              // user.create.before fires from a mutation context, but
              // the GenericCtx union also includes QueryCtx — narrow
              // at runtime so TS lets us call runMutation.
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
              throw new Error(
                "access_denied: this email is not on the Castle allowlist",
              );
            }
            return { data: user };
          },
        },
      },
    },
    plugins: [convex({ authConfig })],
  } satisfies BetterAuthOptions);

export const { getAuthUser } = authComponent.clientApi();

/** Operator-facing user object — Castle UI reads this. Returns null
 *  when not signed in (instead of throwing) so the chat landing can
 *  render a sign-in CTA without redirecting.
 *
 *  Also re-checks the allowlist on every read. The user.create.before
 *  hook only fires on first sign-up; without this revalidation,
 *  removing a pattern from /settings/access wouldn't kick out an
 *  existing operator until their session cookie expired. The
 *  middleware doesn't validate either, so the UI is the actual gate.
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return null;
    const patterns = (await ctx.db
      .query("email_allowlist")
      .collect()).map((r) => r.pattern);
    if (!isEmailAllowedAgainst(user.email, patterns)) return null;
    return user;
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
