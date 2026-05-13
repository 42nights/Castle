import "server-only";
import { Composio } from "@composio/core";
import { VercelProvider } from "@composio/vercel";

export type { ToolkitSlug } from "./composio-shared";

let cached: Composio<VercelProvider> | null = null;

/** Lazy singleton — returns null when no API key, so the rest of the
 *  app works without Composio configured. */
export function composio(): Composio<VercelProvider> | null {
  if (!process.env.COMPOSIO_API_KEY) return null;
  if (!cached) {
    cached = new Composio({
      apiKey: process.env.COMPOSIO_API_KEY,
      provider: new VercelProvider(),
    });
  }
  return cached;
}

/** Loads every Composio tool the user has live connections for. We
 *  don't pass a `toolkits` filter — Composio scopes to whatever the
 *  user's `userId` has connected accounts on. */
export async function getComposioTools(userId: string) {
  const c = composio();
  if (!c) return {};
  try {
    // List the user's connected toolkits, then fetch only those tools.
    const res = await c.connectedAccounts.list({
      userIds: [userId],
      statuses: ["ACTIVE"],
      limit: 100,
    });
    const toolkits = Array.from(
      new Set(res.items?.map((i) => i.toolkit.slug.toLowerCase()) ?? []),
    );
    if (toolkits.length === 0) return {};
    return await c.tools.get(userId, { toolkits });
  } catch (err) {
    console.error("[composio] failed to load tools:", err);
    return {};
  }
}
