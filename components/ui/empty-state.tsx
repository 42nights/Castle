import * as React from "react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  /** Optional 64×64 monoline SVG illustration */
  illustration?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

/**
 * §3.11 — centered empty state with optional illustration, title,
 * description, and action. Max-width 360px per spec.
 */
export function EmptyState({
  illustration,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[360px] flex-col items-center gap-4 py-16 text-center",
        className
      )}
    >
      {illustration && (
        <div className="flex h-16 w-16 items-center justify-center text-ink-3">
          {illustration}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <p className="text-[16px] font-semibold leading-snug text-ink">
          {title}
        </p>
        {description && (
          <p className="text-sm leading-relaxed text-ink-2">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
