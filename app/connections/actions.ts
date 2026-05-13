"use server";

import { revalidatePath } from "next/cache";
import { composio, type ToolkitSlug } from "@/lib/composio";

export type ConnectionStatus = "connected" | "pending" | "none";

export type ConnectionRow = {
  toolkit: ToolkitSlug;
  connectedAccountId: string | null;
  status: ConnectionStatus;
};

export type Toolkit = {
  slug: string;
  name: string;
  logo: string;
  description: string;
  category: string;
  managed: boolean;
  noAuth: boolean;
};

let toolkitCache: { at: number; items: Toolkit[] } | null = null;
const TOOLKIT_TTL_MS = 5 * 60_000;

/** Full Composio toolkit catalog. Cached in-process for 5 min so the
 *  list page doesn't pay the round-trip on every render. */
export async function listToolkits(): Promise<Toolkit[]> {
  const c = composio();
  if (!c) return [];
  if (toolkitCache && Date.now() - toolkitCache.at < TOOLKIT_TTL_MS) {
    return toolkitCache.items;
  }
  try {
    // Pull catalog directly. Composio's SDK list paginates; the v3 REST
    // endpoint supports limit=1000 which returns all toolkits in one
    // shot. Hit it directly to avoid pagination plumbing.
    const res = await fetch(
      "https://backend.composio.dev/api/v3/toolkits?limit=1000",
      {
        headers: { "x-api-key": process.env.COMPOSIO_API_KEY ?? "" },
        next: { revalidate: 300 },
      },
    );
    if (!res.ok) throw new Error(`toolkits list failed: ${res.status}`);
    const json = (await res.json()) as {
      items: Array<{
        slug: string;
        name: string;
        no_auth: boolean;
        composio_managed_auth_schemes: string[];
        meta: {
          description?: string;
          logo?: string;
          categories?: Array<{ id: string; name: string }>;
        };
      }>;
    };
    const items: Toolkit[] = json.items.map((t) => ({
      slug: t.slug,
      name: t.name,
      logo: t.meta.logo ?? "",
      description: t.meta.description ?? "",
      category: t.meta.categories?.[0]?.name ?? "other",
      managed: t.composio_managed_auth_schemes.length > 0,
      noAuth: t.no_auth,
    }));
    toolkitCache = { at: Date.now(), items };
    return items;
  } catch (err) {
    console.error("[connections] toolkit list failed:", err);
    return [];
  }
}

/** Connection status for the given actor across every connected toolkit
 *  (plus any explicitly-requested toolkit slugs — used by the rail to
 *  always render the same row order regardless of connection state). */
export async function listConnections(
  userId: string | null,
): Promise<ConnectionRow[]> {
  const c = composio();
  if (!c || !userId) return [];
  try {
    const res = await c.connectedAccounts.list({
      userIds: [userId],
      limit: 200,
    });
    const byToolkit = new Map<string, ConnectionRow>();
    for (const item of res.items ?? []) {
      const slug = item.toolkit.slug.toLowerCase();
      const prev = byToolkit.get(slug);
      const status: ConnectionStatus =
        item.status === "ACTIVE" ? "connected" : "pending";
      // Prefer ACTIVE over INITIATED/INACTIVE.
      if (!prev || (status === "connected" && prev.status !== "connected")) {
        byToolkit.set(slug, {
          toolkit: slug,
          connectedAccountId: item.id,
          status,
        });
      }
    }
    return Array.from(byToolkit.values()).sort((a, b) =>
      a.toolkit.localeCompare(b.toolkit),
    );
  } catch (err) {
    console.error("[connections] list failed:", err);
    return [];
  }
}

/** Composio-managed auth config per toolkit, created lazily on first
 *  connect; list existing first to avoid duplicates. */
async function getOrCreateAuthConfig(toolkit: ToolkitSlug): Promise<string> {
  const c = composio();
  if (!c) throw new Error("Composio not configured");
  const existing = await c.authConfigs.list({ toolkit });
  const found = existing.items?.find(
    (a) => a.toolkit.slug.toLowerCase() === toolkit,
  );
  if (found) return found.id;

  const created = await c.authConfigs.create(toolkit, {
    type: "use_composio_managed_auth",
    name: `Castle · ${toolkit}`,
  });
  return created.id;
}

function origin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    "http://localhost:3000"
  );
}

export async function initiateConnection(
  toolkit: ToolkitSlug,
  userId: string,
): Promise<{ redirectUrl: string } | { error: string }> {
  const c = composio();
  if (!c) return { error: "COMPOSIO_API_KEY is not set" };
  if (!userId) return { error: "Pick an actor FDE first." };

  try {
    const authConfigId = await getOrCreateAuthConfig(toolkit);
    // Composio's pending connections hold the expired link session.
    // Purge non-ACTIVE rows for this (user, toolkit) so the next link()
    // call issues a fresh nonce instead of re-returning the stale URL.
    try {
      const pending = await c.connectedAccounts.list({
        userIds: [userId],
        toolkitSlugs: [toolkit],
        statuses: [
          "INITIALIZING",
          "INITIATED",
          "EXPIRED",
          "FAILED",
          "INACTIVE",
        ],
        limit: 25,
      });
      for (const p of pending.items ?? []) {
        await c.connectedAccounts.delete(p.id).catch(() => {});
      }
    } catch {
      /* non-fatal */
    }
    // `.link()` is the post-2026-05-08 replacement for the deprecated
    // `.initiate()` on Composio-managed OAuth.
    const conn = await c.connectedAccounts.link(userId, authConfigId, {
      callbackUrl: `${origin()}/connections?return=1`,
    });
    return { redirectUrl: conn.redirectUrl ?? "" };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not initiate connection",
    };
  }
}

export async function disconnect(
  connectedAccountId: string,
): Promise<{ ok: boolean; error?: string }> {
  const c = composio();
  if (!c) return { ok: false, error: "COMPOSIO_API_KEY is not set" };
  try {
    await c.connectedAccounts.delete(connectedAccountId);
    revalidatePath("/connections");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not disconnect",
    };
  }
}
