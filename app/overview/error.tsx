"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";
import { PageShell } from "@/components/page-shell";

export default function OverviewError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[/overview error]", error);
  }, [error]);

  return (
    <PageShell>
      <ErrorState
        title="Couldn't load overview."
        description={
          process.env.NODE_ENV === "development"
            ? error.message
            : "Something went wrong loading the overview. Try again."
        }
        reset={reset}
      />
    </PageShell>
  );
}
