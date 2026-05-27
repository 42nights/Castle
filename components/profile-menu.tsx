"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Avatar } from "@/components/atoms";
import { authClient } from "@/lib/auth-client";

type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

/**
 * Top-nav profile menu. Avatar button (GitHub `image` if available,
 * initials fallback) → dropdown with the user's name + email + a
 * Sign-out action. Routes to /sign-in after sign-out so the middleware
 * doesn't bounce the user mid-render.
 */
export function ProfileMenu() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const user = ((session as { user?: SessionUser } | null) ?? {}).user ?? null;
  const currentUser = useQuery(api.auth.getCurrentUser);
  const isOp = currentUser?.isOperator ?? false;
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Don't render anything until the session resolves — avoids a flash of
  // "not signed in" chrome on every page load. Once Better Auth says
  // there's no user, the middleware would already have redirected; this
  // branch is mostly defensive.
  if (!user) return null;

  const name = user.name ?? user.email ?? "operator";
  const email = user.email ?? "";

  const signOut = async () => {
    setPending(true);
    try {
      // Clear the session cookie server-side WITHOUT going through
      // authClient.signOut(). The auth client's signOut() synchronously
      // updates React state, which triggers Convex to re-run every
      // auth-requiring query before navigation can happen — crashing
      // the page. A raw POST bypasses the React hooks entirely.
      await fetch("/api/auth/sign-out", { method: "POST" });
      window.location.href = "/sign-in";
    } catch {
      setPending(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center rounded-full focus:outline-none focus:ring-1 focus:ring-ink"
        title={name}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {user.image ? (
          <Image
            src={user.image}
            alt={name}
            width={24}
            height={24}
            className="rounded-full border border-line"
            unoptimized
          />
        ) : (
          <Avatar name={name} size={24} />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-64 rounded-sm border border-line bg-page shadow-[0_12px_28px_-12px_rgba(0,0,0,0.45)] py-2"
        >
          <div className="px-3 py-2 border-b border-line">
            <div className="text-[13px] text-ink truncate">{name}</div>
            {email && (
              <div className="num text-[11.5px] text-ink-3 truncate mt-0.5">
                {email}
              </div>
            )}
          </div>
          {isOp && (
            <Link
              href="/settings/access"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-[12.5px] text-ink-2 hover:bg-surface hover:text-ink"
            >
              Access · email allowlist
            </Link>
          )}
          <button
            type="button"
            onClick={signOut}
            disabled={pending}
            className="w-full text-left px-3 py-2 text-[12.5px] text-ink-2 hover:bg-surface hover:text-ink disabled:opacity-50 border-t border-line"
          >
            {pending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
