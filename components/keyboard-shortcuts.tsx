"use client";

// KeyboardShortcuts — §4.4 "g+<key>" navigation shortcuts + cmd-Shift-C deep-link.
// Mount once in app/layout.tsx alongside CommandPalette and KeyboardHelp.
// Does NOT duplicate `?` / cmd-/ (owned by KeyboardHelp) or cmd-K (owned by
// CommandPalette).
//
// Handles when NO input/textarea/contenteditable/select is focused:
//   g → t  →  /templates
//   g → c  →  /customers
//   g → e  →  /engagements
//   g → f  →  /fdes
//   g → x  →  /extractions
//   g → o  →  /overview
//   g → a  →  /assistant
//
// With modifier:
//   cmd-Shift-C  →  copy production deep-link for the current page

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { copyCurrentLink } from "@/components/copy-link-button";

// Map from the second key after `g` to the route path
const G_MAP: Record<string, string> = {
  t: "/templates",
  c: "/customers",
  e: "/engagements",
  f: "/fdes",
  x: "/extractions",
  o: "/overview",
  a: "/assistant",
};

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function KeyboardShortcuts() {
  const router = useRouter();
  // Track whether we're in "g pressed, waiting for second key" state.
  const gPendingRef = useRef(false);
  const gTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // cmd-Shift-C: copy deep-link regardless of input focus
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        const pathname =
          (window as Window & { __copyLinkPathname?: string }).__copyLinkPathname ??
          window.location.pathname;
        copyCurrentLink(pathname);
        return;
      }

      // Single-key shortcuts only fire when no input is focused
      if (isInputFocused()) {
        // Still cancel any pending g-sequence if the user focuses an input
        gPendingRef.current = false;
        if (gTimerRef.current) {
          clearTimeout(gTimerRef.current);
          gTimerRef.current = null;
        }
        return;
      }

      // Ignore if any other modifier is held (except Shift which is for the `?` key)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (gPendingRef.current) {
        // We're waiting for the second key of a g+<key> sequence
        gPendingRef.current = false;
        if (gTimerRef.current) {
          clearTimeout(gTimerRef.current);
          gTimerRef.current = null;
        }

        const route = G_MAP[key];
        if (route) {
          e.preventDefault();
          router.push(route);
        }
        return;
      }

      if (key === "g") {
        e.preventDefault();
        gPendingRef.current = true;
        // Auto-cancel the pending state after 1s if no second key arrives
        gTimerRef.current = setTimeout(() => {
          gPendingRef.current = false;
          gTimerRef.current = null;
        }, 1000);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (gTimerRef.current) clearTimeout(gTimerRef.current);
    };
  }, [router]);

  // Render nothing — this is a behavior-only component
  return null;
}
