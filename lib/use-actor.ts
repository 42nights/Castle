"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "castle.actor_fde_slug";

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

function getServerSnapshot(): string | null {
  return null;
}

export function useActorSlug(): [string | null, (slug: string | null) => void] {
  const slug = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const set = useCallback((next: string | null) => {
    if (typeof window === "undefined") return;
    if (next === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
    // useSyncExternalStore subscribes to "storage" events which only fire
    // for cross-tab changes. Same-tab writes need a manual nudge.
    window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
  }, []);

  return [slug, set];
}
