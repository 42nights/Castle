"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { ReactNode, useMemo } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Provides a Convex client + Better Auth-aware session to the tree.
 *
 * `initialToken` is preloaded server-side in `app/layout.tsx` via
 * `getToken()` from lib/auth-server, so the first render of any
 * `useQuery` already has the right identity attached.
 */
export function ConvexClientProvider({
  children,
  initialToken,
}: {
  children: ReactNode;
  initialToken?: string | null;
}) {
  const client = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    return new ConvexReactClient(url || "https://placeholder.convex.cloud");
  }, []);

  return (
    <ConvexBetterAuthProvider
      client={client}
      authClient={authClient}
      initialToken={initialToken ?? undefined}
    >
      {children}
    </ConvexBetterAuthProvider>
  );
}
