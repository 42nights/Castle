"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#FAFAF7] text-[#1A1813] font-sans flex items-center justify-center px-6">
        <div className="max-w-md text-center flex flex-col items-center gap-4">
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="text-sm text-[#4A4742]">
            {error.message || "An unexpected error occurred."}
          </p>
          {error.digest && (
            <code className="text-xs text-[#8A857C]">Digest: {error.digest}</code>
          )}
          <button
            onClick={() => unstable_retry()}
            className="h-9 px-4 rounded-md bg-[#1A1813] text-[#FAFAF7] text-sm"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
