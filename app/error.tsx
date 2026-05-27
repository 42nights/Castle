"use client";

import { useEffect } from "react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <main className="flex min-h-[50vh] items-center justify-center px-6">
      <div className="max-w-md text-center flex flex-col items-center gap-4">
        <h2 className="text-lg font-semibold text-ink">Something went wrong</h2>
        <p className="text-sm text-ink-3">{error.message}</p>
        <button
          onClick={() => unstable_retry()}
          className="h-9 px-4 rounded-md bg-ink text-page text-sm"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
