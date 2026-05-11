"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexProvider } from "convex/react";
import { ReactNode, useMemo } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      // During the v0 → v1 transition the env may not be set yet.
      // Defer the runtime error; the UI degrades gracefully.
      return null;
    }
    return new ConvexReactClient(url);
  }, []);

  if (!client) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10 text-sm">
        <div className="rounded-md border border-line bg-surface p-5 text-ink-2">
          <p className="font-medium text-ink">Convex not configured.</p>
          <p className="mt-2">
            Set <code className="t-mono">NEXT_PUBLIC_CONVEX_URL</code> in{" "}
            <code className="t-mono">.env.local</code> and run{" "}
            <code className="t-mono">pnpm convex:dev</code> to spin up a dev
            deployment. Then <code className="t-mono">pnpm seed:convex</code>{" "}
            to import the v0 fixture data.
          </p>
        </div>
        {children}
      </div>
    );
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
