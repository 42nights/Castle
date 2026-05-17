"use client";

import { useCallback } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Current operator identity. Used to be a localStorage picker; now
 * the actor is derived from the signed-in Better Auth user.
 *
 * Slug shape: the email's local-part, lowercased.
 *   `jerry.x0930@gmail.com` → `jerry.x0930`
 *   `ayaan@xiao.sh`         → `ayaan`
 *
 * Castle MCP on Railway is still pinned to a single actor via
 * `CASTLE_ACTOR_SLUG` (single-tenant Phase-A state). Anything the
 * chat agent writes via MCP — `agent_actions`, mutation `actor_fde_id`
 * lookups — uses that pinned slug. Until per-user threading lands
 * (Phase B), keep a fallback that matches the MCP's env so the chat
 * UI stays in sync when the session is loading OR the email's local
 * part doesn't match.
 */
const MCP_FALLBACK_SLUG =
  process.env.NEXT_PUBLIC_CASTLE_ACTOR_FALLBACK || "jerry";

export function useActorSlug(): [string | null, (slug: string | null) => void] {
  const { data: session } = authClient.useSession();
  const email = (session as { user?: { email?: string } } | null)?.user?.email;
  const slug = email
    ? email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, "-") ?? null
    : null;

  const set = useCallback((_next: string | null) => {
    /* picker removed — setter is a no-op for back-compat */
  }, []);
  return [slug ?? MCP_FALLBACK_SLUG, set];
}
