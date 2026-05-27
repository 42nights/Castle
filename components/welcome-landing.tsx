"use client";

import { Castle as CastleIcon } from "lucide-react";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function WelcomeLanding() {
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: "/",
        errorCallbackURL: "/sign-in?error=access_denied",
      });
    } catch (err) {
      console.error("[welcome] github sign-in failed:", err);
      setBusy(false);
    }
  };

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
          <h1 className="t-h2 text-ink">Welcome</h1>
          <p className="mt-1 text-[12.5px] text-ink-3 leading-snug max-w-[280px]">
            Sign in with GitHub to access the 42nights operator console
            or browse templates as a guest.
          </p>
        </div>
        <button
          onClick={signIn}
          disabled={busy}
          className="w-full h-10 rounded-md bg-ink text-page text-[14px] inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy ? "Redirecting…" : "Continue with GitHub"}
        </button>
      </div>
    </main>
  );
}
