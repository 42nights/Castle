"use client";

// Error boundary for /templates — must be a Client Component per Next.js spec.
// Uses unstable_retry (this version of Next.js) to re-fetch and re-render.

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";
import { PageShell } from "@/components/page-shell";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Log to error reporting if needed
    console.error("[/templates error]", error);
  }, [error]);

  return (
    <PageShell>
      <ErrorState
        title="Couldn't load the library."
        description={
          process.env.NODE_ENV === "development"
            ? error.message
            : "Something went wrong loading templates. Try again."
        }
        reset={unstable_retry}
      />
    </PageShell>
  );
}
