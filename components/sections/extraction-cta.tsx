"use client";

import { useState } from "react";
import { ExtractPatternDialog } from "@/components/dialogs/extract-pattern-dialog";

export function ExtractPatternButton({
  label = "+ Extract pattern",
  className = "",
  sourceEngagementSlug,
}: {
  label?: string;
  className?: string;
  /** Human-friendly slug (`eng-pe-g`), not a Convex Id. */
  sourceEngagementSlug?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`h-7 px-2.5 rounded-sm border border-line bg-page hover:bg-surface text-[12px] text-ink ${className}`}
      >
        {label}
      </button>
      <ExtractPatternDialog
        open={open}
        onClose={() => setOpen(false)}
        sourceEngagementSlug={sourceEngagementSlug}
      />
    </>
  );
}
