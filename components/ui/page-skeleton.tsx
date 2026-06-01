import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * §3.12 — pulsing skeleton block. Compose via PageSkeleton for full-page
 * loading states, or use SkeletonBlock directly for inline skeletons.
 */
export function SkeletonBlock({
  className,
}: {
  className?: string
}) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-sm bg-surface-1",
        className
      )}
    />
  )
}

interface PageSkeletonProps {
  /** How many body rows to render (default 6) */
  rows?: number
  className?: string
}

/**
 * Full-page loading skeleton: header title + description, then stacked rows.
 * Mount in a route's loading.tsx.
 */
export function PageSkeleton({ rows = 6, className }: PageSkeletonProps) {
  return (
    <div className={cn("w-full", className)}>
      {/* Header */}
      <div className="mb-6 space-y-2.5 pb-4 border-b border-line">
        <SkeletonBlock className="h-8 w-64" />
        <SkeletonBlock className="h-4 w-96 max-w-full" />
      </div>
      {/* Body rows */}
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonBlock key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    </div>
  )
}
