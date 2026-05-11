"use client";

import { ConvexReactClient, ConvexProvider } from "convex/react";
import { ReactNode, useMemo } from "react";

/**
 * Provides a Convex client to the tree.
 *
 * If NEXT_PUBLIC_CONVEX_URL is set: real, reactive client.
 * If not: a placeholder client that never connects, so useQuery returns
 *   undefined indefinitely. This keeps the v0 read-only path functional
 *   while making sure components that call useQuery don't crash.
 */
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    return new ConvexReactClient(url || "https://placeholder.convex.cloud");
  }, []);

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
