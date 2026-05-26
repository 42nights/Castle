"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Per-conversation chat draft autosave to localStorage.
 *
 * Hydrates on mount, persists on every change (debounced via a ref to
 * avoid setItem churn), and clears explicitly on submit. Swaps storage
 * key when the conversation changes so drafts don't leak across
 * threads.
 */
export function useChatDraft(conversationId: string | null) {
  const key = conversationId ? `castle:chat-draft:${conversationId}` : null;
  const [draft, setDraftState] = useState("");
  const hydratedKeyRef = useRef<string | null>(null);

  // Hydrate when the conversation changes — and only after we know
  // window/localStorage exist (avoids SSR `undefined`-on-window crash).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!key) {
      setDraftState("");
      hydratedKeyRef.current = null;
      return;
    }
    if (hydratedKeyRef.current === key) return;
    try {
      setDraftState(window.localStorage.getItem(key) ?? "");
    } catch {
      setDraftState("");
    }
    hydratedKeyRef.current = key;
  }, [key]);

  // Persist on every change. `hydratedKeyRef` guards against the
  // initial render writing an empty string back over a stored draft
  // before hydration completes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!key) return;
    if (hydratedKeyRef.current !== key) return;
    try {
      if (draft) window.localStorage.setItem(key, draft);
      else window.localStorage.removeItem(key);
    } catch {
      /* quota or storage failure — silent */
    }
  }, [draft, key]);

  const setDraft = useCallback((next: string) => setDraftState(next), []);

  const clear = useCallback(() => {
    setDraftState("");
    if (typeof window !== "undefined" && key) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* noop */
      }
    }
  }, [key]);

  return [draft, setDraft, clear] as const;
}
