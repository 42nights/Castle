"use client";

import { useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Current operator identity. The actor slug is now read from
 * `auth.getCurrentUser` (server-side FDE resolution) rather than
 * derived client-side from the email. This ensures the slug matches
 * what the MCP writes onto audit rows.
 *
 * The server-side KNOWN_SLUG_MAP in convex/auth.ts handles cases where
 * the email local-part differs from the FDE slug (e.g. jerry.x0930 → jerry).
 */
export function useActorSlug(): [string | null, (slug: string | null) => void] {
  const user = useQuery(api.auth.getCurrentUser, {});
  const slug = (user as { fde_slug?: string | null } | null | undefined)?.fde_slug ?? null;

  const set = useCallback((_next: string | null) => {
    /* picker removed — setter is a no-op for back-compat */
  }, []);

  return [slug ?? null, set];
}
