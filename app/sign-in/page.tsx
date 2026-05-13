"use client";

import { Castle as CastleIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { ALLOWLIST_DESCRIPTION } from "@/lib/auth-allowlist";

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
      {denied && (
        <div className="w-full rounded-sm border border-accent/40 bg-accent/10 px-3 py-2 text-[12.5px] text-accent leading-snug">
          <div className="font-medium text-ink">Access denied</div>
          <div className="mt-0.5 text-ink-2">{ALLOWLIST_DESCRIPTION}</div>
        </div>
      )}
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
            42nights operator console. Sign in with GitHub.
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}
