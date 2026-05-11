import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { OverviewIsland } from "@/components/overview-island";
import { OverviewSections } from "@/components/overview-sections";
import { loadAll } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (convexUrl) {
    try {
      // Live, reactive path via Convex.
      const preloaded = await preloadQuery(api.dashboard.overview, {});
      return <OverviewIsland preloaded={preloaded} />;
    } catch (err) {
      console.error("[/] preloadQuery failed; using JSON fixture:", err);
    }
  }

  // Fallback: v0 read-only path while Convex isn't provisioned / unreachable.
  const data = loadAll();
  return <OverviewSections data={data} />;
}
