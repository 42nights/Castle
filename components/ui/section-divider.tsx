import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * §3.17 — Operator section divider.
 * Small uppercase eyebrow-style heading. Matches the existing SectionHeader
 * in page-shell.tsx but lives here as a standalone primitive so other agents
 * can import it without touching page-shell.tsx.
 */
export function SectionDivider({
  title,
  description,
  right,
  className,
}: {
  title: string
  description?: React.ReactNode
  right?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-6 mb-3", className)}>
      <div>
        <h2 className="t-h2">{title}</h2>
        {description && (
          <p className="mt-0.5 text-ink-3 text-[12px] leading-snug max-w-xl">
            {description}
          </p>
        )}
      </div>
      {right}
    </div>
  )
}

/**
 * §3.17 — Editorial section header.
 * Fraunces at text-xl (24px), with an optional thin rule beneath it.
 * Used on investor-facing pages (/templates, /extractions).
 */
export function EditorialSectionHeader({
  title,
  align = "left",
  rule = true,
  className,
}: {
  title: string
  align?: "left" | "center"
  rule?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "mb-6",
        align === "center" && "text-center",
        className
      )}
    >
      <h2 className="t-headline text-ink">{title}</h2>
      {rule && (
        <div className="mt-3 h-px w-full bg-line" />
      )}
    </div>
  )
}
