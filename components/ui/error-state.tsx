"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

// Minimal broken-page monoline illustration
function BrokenPageIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {/* Page outline */}
      <rect x="10" y="6" width="36" height="46" rx="3" />
      {/* Torn fold corner */}
      <polyline points="34,6 34,18 46,18" />
      {/* Crack lines */}
      <path d="M20 30 l4 4 -2 3 4 4" />
      {/* Horizontal lines (content) */}
      <line x1="20" y1="24" x2="38" y2="24" />
      <line x1="20" y1="44" x2="34" y2="44" />
    </svg>
  )
}

interface ErrorStateProps {
  title?: string
  description?: string
  /** Called when the user clicks "Try again". Required to show the button. */
  reset?: () => void
  className?: string
}

/**
 * §3.13 — page-level error state. Mount inside a route's error.tsx and pass
 * the Next.js `reset` prop through.
 */
export function ErrorState({
  title = "Something went wrong.",
  description,
  reset,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[360px] flex-col items-center gap-4 py-16 text-center",
        className
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center text-ink-3">
        <BrokenPageIcon />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-[16px] font-semibold leading-snug text-ink">
          {title}
        </p>
        {description && (
          <p className="text-sm leading-relaxed text-ink-2">{description}</p>
        )}
      </div>
      <div className="flex flex-col items-center gap-2">
        {reset && (
          <button
            onClick={reset}
            className="inline-flex h-8 items-center rounded-sm bg-ink px-3 text-sm font-medium text-paper shadow-[var(--shadow-sm)] transition-colors duration-instant hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Try again
          </button>
        )}
        <Link
          href="/overview"
          className="text-sm text-ink-3 underline underline-offset-4 hover:text-ink transition-colors duration-instant"
        >
          Back to overview
        </Link>
      </div>
    </div>
  )
}
