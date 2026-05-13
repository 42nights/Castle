import { preloadQuery } from "convex/nextjs";
import type { Preloaded } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OverviewIsland } from "@/components/overview-island";
import { OverviewSections } from "@/components/overview-sections";
import { loadAll } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  let preloaded: Preloaded<typeof api.dashboard.overview> | null = null;
  if (convexUrl) {
    try {
      preloaded = await preloadQuery(api.dashboard.overview, {});
    } catch (err) {
      console.error("[/overview] preloadQuery failed; using JSON fixture:", err);
    }
  }

  if (preloaded) return <OverviewIsland preloaded={preloaded} />;
  return <OverviewSections data={loadAll()} />;
}
