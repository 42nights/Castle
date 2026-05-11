"use client";

import { Preloaded, usePreloadedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { adaptOverview, type ConvexOverview } from "@/lib/adapters";
import { OverviewSections } from "@/components/overview-sections";

export function OverviewIsland({
  preloaded,
}: {
  preloaded: Preloaded<typeof api.dashboard.overview>;
}) {
  const snapshot = usePreloadedQuery(preloaded) as unknown as ConvexOverview;
  const data = adaptOverview(snapshot);
  return <OverviewSections data={data} />;
}
