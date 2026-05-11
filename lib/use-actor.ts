"use client";

import { useEffect, useState } from "react";

const KEY = "castle.actor_fde_slug";

export function useActorSlug(): [string | null, (slug: string | null) => void] {
  const [slug, setSlug] = useState<string | null>(null);
  useEffect(() => {
    setSlug(localStorage.getItem(KEY));
  }, []);
  const set = (next: string | null) => {
    if (next === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
    setSlug(next);
  };
  return [slug, set];
}
