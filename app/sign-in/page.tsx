"use client";

// 'use client' required — uses hooks: useRouter, useSearchParams, useState,
// and authClient.signIn.social (browser-only Better Auth SDK call).

import { Castle as CastleIcon, GitBranch } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { ALLOWLIST_DESCRIPTION } from "@/lib/auth-allowlist";
import { Button } from "@/components/ui/button";

/**
 * GitHub-only sign-in. Castle is restricted to 42nights operators —
 * the allowlist lives in `lib/auth-allowlist.ts`. Server-side rejection
 * happens in `convex/auth.ts`'s `databaseHooks.user.create.before`; if
 * a non-allowlisted email signs in, Better Auth bounces back to this
 * page with `?error=access_denied`.
 */
export default function SignInPage() {
  return (
    <Suspense fallback={<Shell />}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callback = params.get("callbackUrl") || "/";
  const error = params.get("error");
  const denied = error === "access_denied" || error?.includes("access_denied");
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: callback,
        errorCallbackURL: "/sign-in?error=access_denied",
      });
    } catch (err) {
      console.error("[sign-in] github failed:", err);
      setBusy(false);
    }
  };

  return (
    <Shell>
      {/* Access denied banner */}
      {denied && (
        <div
          role="alert"
          className="w-full rounded-md bg-health-soft-bad px-4 py-3 text-[13px] text-health-bad border border-health-bad/20"
        >
          <p className="font-semibold text-ink mb-0.5">Access denied</p>
          <p className="text-ink-2 leading-snug">{ALLOWLIST_DESCRIPTION}</p>
        </div>
      )}

      {/* GitHub sign-in button */}
      <Button
        onClick={signIn}
        disabled={busy}
        loading={busy}
        size="lg"
        className="w-full"
        iconStart={!busy ? <GitBranch size={16} aria-hidden="true" /> : undefined}
        aria-label="Continue with GitHub"
      >
        {busy ? "Redirecting…" : "Continue with GitHub"}
      </Button>

      {/* Ask for access */}
      <p className="text-[12px] text-ink-3 text-center">
        Need access?{" "}
        <a
          href="mailto:ayaan@42nights.dev"
          className="text-ink-2 underline underline-offset-2 decoration-line hover:text-ink transition-colors"
        >
          Ask Ayaan
        </a>
      </p>

      {/* Back navigation */}
      <button
        onClick={() => router.back()}
        className="text-[11px] text-ink-4 hover:text-ink-3 transition-colors focus-visible:shadow-[var(--shadow-focus)] outline-none rounded-sm"
        aria-label="Go back"
      >
        back
      </button>
    </Shell>
  );
}

function Shell({ children }: { children?: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      {/* Centered card */}
      <div className="w-full max-w-sm">
        <div className="rounded-xl bg-canvas shadow-[var(--shadow-xl)] p-12 flex flex-col items-center gap-6">
          {/* Castle wordmark */}
          <div className="flex items-center gap-2 text-ink">
            <CastleIcon size={32} strokeWidth={1.5} aria-hidden="true" />
            <span className="text-[32px] font-semibold tracking-[-0.02em] leading-none">
              Castle
            </span>
          </div>

          {/* Tagline */}
          <p className="text-[13px] text-ink-3 text-center leading-snug -mt-2">
            The operating console for 42nights.
          </p>

          {children}
        </div>
      </div>
    </main>
  );
}
