import * as React from "react"
import { cn } from "@/lib/utils"

type ProgressVariant = "default" | "good" | "warn" | "bad"

const fillClass: Record<ProgressVariant, string> = {
  default: "bg-accent",
  good: "bg-health-good",
  warn: "bg-health-warn",
  bad: "bg-health-bad",
}

interface ProgressBarProps {
  /** 0–100 */
  value: number
  variant?: ProgressVariant
  /** Show the 5-segment capacity-bar style */
  segmented?: boolean
  className?: string
  "aria-label"?: string
}

/**
 * §3.18 — soft progress bar with a track and animated fill.
 * role="progressbar" per spec.
 */
export function ProgressBar({
  value,
  variant = "default",
  segmented = false,
  className,
  "aria-label": ariaLabel,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value))

  if (segmented) {
    return (
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel}
        className={cn("flex h-1.5 w-full gap-0.5", className)}
      >
        {Array.from({ length: 5 }).map((_, i) => {
          const segmentMin = i * 20
          const filled = clamped >= segmentMin + 20
          const partial = !filled && clamped > segmentMin

          return (
            <div
              key={i}
              className="relative flex-1 overflow-hidden rounded-full bg-surface-2"
            >
              {(filled || partial) && (
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-[width] duration-slow ease-out",
                    fillClass[variant]
                  )}
                  style={{
                    width: filled
                      ? "100%"
                      : `${((clamped - segmentMin) / 20) * 100}%`,
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-surface-2",
        className
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-0 rounded-full transition-[width] duration-slow ease-out",
          fillClass[variant]
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
