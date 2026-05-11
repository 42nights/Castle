"use client";

import { useMutation } from "convex/react";
import { toast } from "sonner";
import type { FunctionReference } from "convex/server";

/**
 * Wraps `useMutation` so every call surfaces a toast and short-circuits
 * when Convex isn't configured.
 */
export function useRunMutation<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  M extends FunctionReference<"mutation", "public", any, any>,
>(ref: M) {
  const fn = useMutation(ref);
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
      return await promise;
    } catch {
      return undefined;
    }
  };
}
