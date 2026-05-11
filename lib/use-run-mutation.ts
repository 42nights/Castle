"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { FunctionReference } from "convex/server";

/**
 * Wraps `useMutation` so every call surfaces a toast, short-circuits
 * when Convex isn't configured, AND nudges the Next router to refetch
 * server data afterward. Pages use `dynamic = "force-dynamic"` so the
 * refresh re-runs `loadOverview()` and the page re-renders against the
 * fresh Convex snapshot. Reactive `useQuery` consumers (overview island,
 * attention list) update automatically without this.
 */
export function useRunMutation<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  M extends FunctionReference<"mutation", "public", any, any>,
>(ref: M) {
  const fn = useMutation(ref);
  const router = useRouter();
  return async (
    args: M["_args"],
    labels: { loading?: string; success?: string; error?: string } = {},
  ): Promise<M["_returnType"] | undefined> => {
    if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
      toast.error("Convex not configured — read-only mode");
      return undefined;
    }
    const promise = fn(args);
    toast.promise(promise, {
      loading: labels.loading ?? "Saving…",
      success: labels.success ?? "Saved.",
      error: (err) =>
        labels.error ??
        (err instanceof Error ? err.message : "Could not save — retry?"),
    });
    try {
      const result = await promise;
      router.refresh();
      return result;
    } catch {
      return undefined;
    }
  };
}
