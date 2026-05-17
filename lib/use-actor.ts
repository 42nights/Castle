"use client";

import { useCallback } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Current operator identity. Used to be a localStorage picker; now the
 * actor is derived from the signed-in Better Auth user.
 *
 * Slug shape: the email's local-part, lowercased.
 *   `jerry.x0930@gmail.com` → `jerry.x0930`
 *   `ayaan@xiao.sh`         → `ayaan`
 *
 * Returns `[null, noop]` while the session is loading or signed out.
 * The tuple shape matches the old API so every existing call site
 * keeps working without changes.
 */
export function useActorSlug(): [string | null, (slug: string | null) => void] {
  const { data: session } = authClient.useSession();
  const email = (session as { user?: { email?: string } } | null)?.user?.email;
  const slug = email
    ? email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, "-") ?? null
    : null;

  // Picker removed — actor is derived from the session. Setter is a
  // no-op so call sites that still destructure it don't crash.
  const set = useCallback((_next: string | null) => {
    /* no-op */
  }, []);
  return [slug, set];
}
