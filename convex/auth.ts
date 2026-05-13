import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { createClient, GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import { internalAction, query } from "./_generated/server";
import { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";
import { isEmailAllowed } from "../lib/auth-allowlist";

/**
 * Castle auth — Better Auth with the Convex component backing it.
 * GitHub OAuth only. No email/password, no magic link, no anonymous.
 * Sessions and users live in the betterAuth component's tables; FDE
 * rows in our own schema get linked by Better Auth user id.
 */

const siteUrl = process.env.SITE_URL;

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: siteUrl,
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
            if (!isEmailAllowed(email)) {
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
 *  render a sign-in CTA without redirecting. */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => authComponent.safeGetAuthUser(ctx),
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
