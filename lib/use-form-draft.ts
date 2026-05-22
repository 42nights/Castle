"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type DraftEnvelope<T> = {
  values: T;
  savedAt: string;
};

/**
 * Per-dialog form-draft autosave to localStorage.
 *
 * Pattern: the dialog calls `save(values)` whenever its state changes
 * (via a useEffect with state deps). `snapshot` exposes the most recent
 * stored values + savedAt timestamp, so the dialog can auto-restore on
 * open and render a "Restored from N minutes ago" banner. `clear()`
 * wipes the entry on successful submit or explicit discard.
 *
 * Wholly-empty drafts (every value falsy / empty-array) auto-purge so
 * stale empty envelopes don't sit in localStorage forever.
 */
export function useFormDraft<T extends Record<string, unknown>>(
  storageKey: string,
) {
  const [snapshot, setSnapshot] = useState<DraftEnvelope<T> | null>(null);
  const [hydrated, setHydrated] = useState(false);
  // Stable ref of the last *saved* JSON string so a save() call that
  // would no-op doesn't churn localStorage on every render.
  const lastSerializedRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftEnvelope<T>;
        if (
          parsed &&
          typeof parsed === "object" &&
          "values" in parsed &&
          "savedAt" in parsed
        ) {
          setSnapshot(parsed);
          lastSerializedRef.current = raw;
        }
      }
    } catch {
      // Corrupt entry — drop it.
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        /* noop */
      }
    }
    setHydrated(true);
  }, [storageKey]);

  const save = useCallback(
    (values: T) => {
      if (typeof window === "undefined") return;
      const empty = Object.values(values).every(
        (v) =>
          v === "" ||
          v === null ||
          v === undefined ||
          (Array.isArray(v) && v.length === 0),
      );
      if (empty) {
        if (lastSerializedRef.current !== null) {
          try {
            window.localStorage.removeItem(storageKey);
          } catch {
            /* noop */
          }
          lastSerializedRef.current = null;
          setSnapshot(null);
        }
        return;
      }
      const envelope: DraftEnvelope<T> = {
        values,
        savedAt: new Date().toISOString(),
      };
      // Skip write if values haven't actually changed since last save —
      // savedAt would update but localStorage churn on every keystroke
      // is wasteful and breaks the savedAt "stable across noop renders"
      // expectation.
      const valuesJson = JSON.stringify(values);
      const prevValuesJson = lastSerializedRef.current
        ? (JSON.parse(lastSerializedRef.current) as DraftEnvelope<T>).values
        : null;
      if (JSON.stringify(prevValuesJson) === valuesJson) return;
      try {
        const out = JSON.stringify(envelope);
        window.localStorage.setItem(storageKey, out);
        lastSerializedRef.current = out;
        setSnapshot(envelope);
      } catch {
        // quota or storage failure — silent.
      }
    },
    [storageKey],
  );

  const clear = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* noop */
    }
    lastSerializedRef.current = null;
    setSnapshot(null);
  }, [storageKey]);

  return { snapshot, save, clear, hydrated };
}

/** Human-friendly relative time for the restore banner. */
export function relativeSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
