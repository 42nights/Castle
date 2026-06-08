"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";
import { PageShell } from "@/components/page-shell";

export default function ExtractionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[/extractions error]", error);
  }, [error]);

  return (
    <PageShell>
      <ErrorState
        title="Couldn't load extractions."
        description={
          process.env.NODE_ENV === "development"
            ? error.message
            : "Something went wrong loading extractions. Try again."
        }
        reset={reset}
      />
    </PageShell>
  );
}
