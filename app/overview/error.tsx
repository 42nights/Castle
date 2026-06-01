"use client";

import { ErrorState } from "@/components/ui/error-state";
import { PageShell } from "@/components/page-shell";

export default function OverviewError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageShell>
      <ErrorState
        title="Couldn't load overview."
        description={error.message}
        reset={reset}
      />
    </PageShell>
  );
}
