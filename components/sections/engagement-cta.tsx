"use client";

import { useState } from "react";
import { CreateEngagementDialog } from "@/components/dialogs/create-engagement-dialog";

export function NewEngagementButton({
  label = "+ New engagement",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`h-8 px-3 rounded-sm border border-line bg-page hover:bg-surface text-[12.5px] text-ink ${className}`}
      >
        {label}
      </button>
      <CreateEngagementDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
