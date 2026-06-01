"use client";

// PulseOnChange — §4.12 real-time visual signal.
// Wraps a displayed value and fires the `animate-soft-pulse` class for ~250ms
// whenever the value prop changes. Uses a ref to track previous value and
// a key-swap to restart the CSS animation cleanly.
//
// Usage:
//   <PulseOnChange value={liveNumber}>{formatCurrency(liveNumber)}</PulseOnChange>
//
// The animation class is defined in globals.css:
//   @keyframes soft-pulse { 0%,100% { opacity:1 } 50% { opacity:0.55 } }
//   .animate-soft-pulse { animation: soft-pulse 250ms var(--ease-out); }
//
// prefers-reduced-motion is already guarded in globals.css via the
//   @media (prefers-reduced-motion: reduce) block which sets animation-duration
//   to 0.01ms — so the class is safe to always apply.

import { useEffect, useRef, useState } from "react";

type PulseOnChangeProps = {
  value: unknown;
  children: React.ReactNode;
  className?: string;
};

export function PulseOnChange({ value, children, className }: PulseOnChangeProps) {
  const prevRef = useRef(value);
  // pulseKey increments on each value change to force React to remount the
  // inner span, which restarts the CSS animation from 0%.
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setPulseKey((k) => k + 1);
    }
  }, [value]);

  return (
    <span
      key={pulseKey}
      className={pulseKey > 0 ? `animate-soft-pulse${className ? ` ${className}` : ""}` : className}
    >
      {children}
    </span>
  );
}
