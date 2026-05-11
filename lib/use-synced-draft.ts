"use client";

import { useState } from "react";

/**
 * React 19-friendly "draft of a prop" hook.
 *
 * - Reads the upstream `value` on every render
 * - If `value` changes (e.g. live Convex update) AND user isn't mid-edit,
 *   adopts the new value as the draft via setState-during-render. No effect.
 * - When user is mid-edit (`editing === true`), incoming changes from
 *   upstream are remembered but the draft stays untouched until they save
 *   or cancel.
 */
export function useSyncedDraft<T>(value: T, editing: boolean = false) {
  const [prev, setPrev] = useState(value);
  const [draft, setDraft] = useState(value);

  if (value !== prev) {
    setPrev(value);
    if (!editing) setDraft(value);
  }

  return [draft, setDraft, () => setDraft(value)] as const;
}
