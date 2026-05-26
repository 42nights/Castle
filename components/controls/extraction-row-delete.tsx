"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useIsOperator } from "@/lib/role-context";
import { useRunMutation } from "@/lib/use-run-mutation";

/**
 * Tiny inline `×` button to delete a single pattern extraction.
 * Cascades to its reuse rows (the Convex `remove` mutation handles
 * that). Single confirm before destructive action.
 */
export function ExtractionRowDelete({
  extractionId,
}: {
  extractionId: string;
}) {
  const op = useIsOperator();
  const run = useRunMutation(api.patternExtractions.remove);
  const [pending, setPending] = useState(false);

  if (!op) return null;

  const remove = async () => {
    if (pending) return;
    if (!confirm("Delete this extraction? Cascades to its reuse rows.")) {
      return;
    }
    setPending(true);
    try {
      await run(
        { id: extractionId as never },
        { success: "Extraction deleted." },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      title="Delete extraction"
      aria-label="Delete extraction"
      className="text-ink-3 hover:text-accent text-[14px] leading-none disabled:opacity-40"
    >
      ×
    </button>
  );
}
