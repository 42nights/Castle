"use client";

// RecordRecent — drop into any detail page to persist a recently-viewed entry.
// Fire-and-forget on mount; no UI rendered.
//
// Usage (in a detail page's JSX, after the main content):
//   <RecordRecent kind="template" slug={tpl.id} title={tpl.name} />

import { useEffect } from "react";
import { useRecents } from "@/lib/use-recents";

type RecentKind = "customer" | "engagement" | "fde" | "template" | "extraction";

type RecordRecentProps = {
  kind: RecentKind;
  slug: string;
  title: string;
};

export function RecordRecent({ kind, slug, title }: RecordRecentProps) {
  const { record } = useRecents();

  useEffect(() => {
    record(kind, slug, title);
    // Only record on mount — slug/title changes would be a navigation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
