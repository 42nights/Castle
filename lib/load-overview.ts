import "server-only";

import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { adaptOverview, type ConvexOverview } from "@/lib/adapters";
import { loadAll as loadJson } from "@/lib/data";
import type {
  Customer,
  Deployment,
  Engagement,
  FDE,
  FounderHoursEntry,
  PatternExtraction,
  Template,
} from "@/lib/types";

export type LoadedOverview = {
  fdes: FDE[];
  customers: Customer[];
  engagements: Engagement[];
  templates: Template[];
  deployments: Deployment[];
  patternExtractions: PatternExtraction[];
  founderHours: FounderHoursEntry[];
  /** Convex `_id` keyed by human slug — only populated when in Convex mode. */
  convexIdBySlug: Record<string, string>;
};

/**
 * Single server-side loader. Picks Convex when `NEXT_PUBLIC_CONVEX_URL` is
 * set, otherwise falls back to v0 `data/*.json`. Both shapes adapt to the
 * same `LoadedOverview` so list + detail pages can stay shape-agnostic.
 */
export async function loadOverview(): Promise<LoadedOverview> {
  if (process.env.NEXT_PUBLIC_CONVEX_URL) {
    const snapshot = (await fetchQuery(
      api.dashboard.overview,
      {},
    )) as unknown as ConvexOverview;
    const adapted = adaptOverview(snapshot);
    const convexIdBySlug: Record<string, string> = {};
    for (const f of snapshot.fdes) convexIdBySlug[f.slug] = f._id;
    for (const c of snapshot.customers) convexIdBySlug[c.slug] = c._id;
    for (const e of snapshot.engagements) convexIdBySlug[e.slug] = e._id;
    for (const t of snapshot.templates) convexIdBySlug[t.slug] = t._id;
    return {
      fdes: adapted.fdes,
      customers: adapted.customers,
      engagements: adapted.engagements,
      templates: adapted.templates,
      deployments: adapted.deployments,
      patternExtractions: adapted.patternExtractions,
      founderHours: adapted.founderHours,
      convexIdBySlug,
    };
  }
  const json = loadJson();
  return { ...json, convexIdBySlug: {} };
}
