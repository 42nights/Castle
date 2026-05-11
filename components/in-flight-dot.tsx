"use client";

import { useConvex } from "convex/react";
import { useEffect, useState } from "react";

/**
 * Tiny pulse next to the wordmark when Convex has any active subscriptions
 * still resolving. Stays invisible until the client connects and starts
 * fetching. Falls back gracefully when the placeholder client is used.
 */
export function InFlightDot() {
  const convex = useConvex();
  const [active, setActive] = useState(false);

  useEffect(() => {
    // Convex's connectionState is private API; we poll it cheaply.
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      try {
        const state = (convex as unknown as {
          connectionState: () => {
            isWebSocketConnected: boolean;
            hasInflightRequests: boolean;
          };
        }).connectionState();
        setActive(state.hasInflightRequests);
      } catch {
        /* placeholder client */
      }
    };
    const id = setInterval(tick, 250);
    tick();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [convex]);

  return (
    <span
      aria-hidden
      className={[
        "inline-block h-1 w-1 rounded-full transition-opacity",
        active ? "bg-accent animate-pulse opacity-100" : "opacity-0",
      ].join(" ")}
    />
  );
}
