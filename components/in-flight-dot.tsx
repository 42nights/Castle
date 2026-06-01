"use client";

import { useConvex } from "convex/react";
import { useEffect, useRef, useState } from "react";

const KEYFRAME_ID = "castle-in-flight-pulse";

function ensureKeyframe() {
  if (typeof document === "undefined") return;
  if (document.getElementById(KEYFRAME_ID)) return;
  const style = document.createElement("style");
  style.id = KEYFRAME_ID;
  style.textContent = `
    @keyframes in-flight-pulse {
      0%, 100% { opacity: 0.4; }
      50%       { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

/**
 * §3.20 — Soft pulsing 6px amber dot. Visible only when Convex has active
 * in-flight requests. Animation: 1.5s ease-out-soft, opacity 0.4 → 1 → 0.4.
 * Falls back silently when the placeholder client is used.
 */
export function InFlightDot() {
  const convex = useConvex();
  const [active, setActive] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      ensureKeyframe();
      mounted.current = true;
    }

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
        /* placeholder client — stay silent */
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
      className="inline-block h-1.5 w-1.5 rounded-full bg-accent transition-opacity duration-quick"
      style={
        active
          ? {
              opacity: 1,
              animation:
                "in-flight-pulse 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite",
            }
          : { opacity: 0 }
      }
    />
  );
}
