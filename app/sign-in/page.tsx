"use client";

import { Castle as CastleIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * GitHub-only sign-in. Castle is an internal tool for the 42nights org;
 * everyone who needs access has a GitHub account already.
 *
 * `useSearchParams` must sit under a Suspense boundary for Next 16's
 * prerender step — the page export wraps it.
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
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: callback,
      });
    } catch (err) {
      console.error("[sign-in] github failed:", err);
      setBusy(false);
    }
  };

  return (
    <Shell>
      <button
        onClick={signIn}
        disabled={busy}
        className="w-full h-10 rounded-md bg-ink text-page text-[14px] inline-flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {busy ? "Redirecting…" : "Continue with GitHub"}
      </button>
      <button
        onClick={() => router.back()}
        className="text-[11.5px] text-ink-3 hover:text-ink"
      >
        back
      </button>
    </Shell>
  );
}

function Shell({ children }: { children?: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 -mt-16">
        <div className="flex items-baseline gap-2 text-ink">
          <CastleIcon size={20} strokeWidth={1.75} />
          <span className="text-[20px] font-semibold tracking-[-0.01em]">
            Castle
          </span>
        </div>
        <div className="text-center">
          <h1 className="t-h2 text-ink">Sign in</h1>
          <p className="mt-1 text-[12.5px] text-ink-3 leading-snug">
            42nights operator console. Only members of the org can sign in.
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}
