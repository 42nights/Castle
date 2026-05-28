"use client";

import { useCallback } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Current operator identity. Used to be a localStorage picker; now
 * the actor is derived from the signed-in Better Auth user.
 *
 * Slug shape: the email's local-part, lowercased — UNLESS the email
 * has a known mapping below, in which case the mapped slug wins.
 *   `jerry.x0930@gmail.com` → `jerry`           (mapped)
 *   `ayaan@xiao.sh`         → `ayaan`           (derived)
 *
 * The mapping exists because Castle MCP on Railway pins to a single
 * actor (`CASTLE_ACTOR_SLUG=jerry`) and writes that slug onto
 * `agent_actions` / audit fields, but the matching FDE row in Convex
 * has slug `jerry`, not `jerry.x0930`. Without the mapping the chat
 * UI's `agentActions.listOpen` query would filter by `jerry.x0930`
 * and miss the row, so the inline connect button never renders.
 * When per-user FDE binding lands, replace this with a Convex lookup.
 */
const KNOWN_SLUG_MAP: Record<string, string> = {
  "jerry.x0930@gmail.com": "jerry",
};

export function useActorSlug(): [string | null, (slug: string | null) => void] {
  const { data: session } = authClient.useSession();
  const email = (session as { user?: { email?: string } } | null)?.user?.email;
  const normalized = email?.trim().toLowerCase() ?? null;
  const slug = normalized
    ? KNOWN_SLUG_MAP[normalized] ??
      normalized.split("@")[0]?.replace(/[^a-z0-9._-]/g, "-") ??
      null
    : null;

  const set = useCallback((_next: string | null) => {
    /* picker removed — setter is a no-op for back-compat */
  }, []);
  // No session = no actor. The MCP_FALLBACK_SLUG used to kick in for
  // session-loading frames, but with `/` now public, an anonymous
  // visitor would have gotten `jerry` and the sidebar would have
  // auto-selected his conversations → privacy leak. Better: render an
  // empty chat shell for one frame than ever serve Jerry's history to
  // a stranger.
  return [slug ?? null, set];
}
