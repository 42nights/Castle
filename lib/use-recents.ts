"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback } from "react";
import { api } from "@/convex/_generated/api";
import { useQuery as useAuthQuery } from "convex/react";

type RecentKind = "customer" | "engagement" | "fde" | "template" | "extraction";

/**
 * Returns a `record` function that persists a recently viewed entity and
 * a `recents` array of the last 10 viewed (newest first).
 *
 * Silently no-ops when the user isn't signed in (user_id is null).
 */
export function useRecents() {
  const user = useAuthQuery(api.auth.getCurrentUser, {});
  const userId = (user as { id?: string } | null | undefined)?.id ?? null;

  const recordMutation = useMutation(api.userRecents.record);
  const recents = useQuery(
    api.userRecents.listForUser,
    userId ? { user_id: userId } : "skip",
  );

  const record = useCallback(
    (kind: RecentKind, slug: string, title: string) => {
      if (!userId) return;
      recordMutation({ user_id: userId, kind, slug, title }).catch(() => {
        // Fire-and-forget: best effort, don't break the page on error
      });
    },
    [userId, recordMutation],
  );

  return {
    record,
    recents: recents ?? [],
  };
}
