import "server-only";

import { fetchQuery } from "convex/nextjs";
import { redirect } from "next/navigation";
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
/**
 * Server-side allowlist gate for operator pages. `getCurrentUser`
 * already returns null when the session is invalid OR when the email
 * has been removed from the allowlist after sign-in. Pages that show
 * operator data (templates, customers, settings) call this first so a
 * stale session cookie can't keep an ex-operator on the console.
 *
 * The chat landing at "/" does NOT call this — it's intentionally
 * public.
 *
 * If Convex itself is unreachable we fall through (don't redirect) so
 * `loadOverview`'s existing JSON-fixture fallback still renders. A
 * complete platform outage shouldn't masquerade as an auth failure.
 */
export async function requireOperator(): Promise<void> {
  // Pure JSON-fixture mode (no Convex env at all) — there's no auth
  // backend to consult and no live data being served, so we let the
  // page render. This matches the loadOverview fallback contract.
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) return;
  // Convex is configured → the page is about to serve live operator
  // data. The middleware only checks cookie presence, so this is the
  // real gate. Fail closed on any error: auth misconfigured,
  // unreachable, or session invalid all map to "redirect to sign-in".
  //
  // TRADE-OFF: loadOverview() has a documented JSON-fixture fallback
  // for "Convex unreachable" scenarios. Since the same outage that
  // breaks fetchQuery also breaks fetchAuthQuery, the fallback is
  // unreachable in prod when this gate is active — we redirect to
  // /sign-in instead of rendering stale fixture data to an
  // unauthenticated viewer. Stale-and-anonymous is worse than "Castle
  // is down, sign in to retry" for an operator console.
  let user: unknown;
  try {
    const { fetchAuthQuery } = await import("@/lib/auth-server");
    user = await fetchAuthQuery(api.auth.getCurrentUser, {});
  } catch {
    redirect("/sign-in");
  }
  if (!user) redirect("/sign-in");
}

export async function loadOverview(): Promise<LoadedOverview> {
  await requireOperator();
  if (process.env.NEXT_PUBLIC_CONVEX_URL) {
    try {
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
    } catch (err) {
      // Convex unreachable / mis-configured. Fall back to the v0 JSON
      // snapshot so pages still render instead of throwing a server error.
      console.error("[loadOverview] Convex fetch failed; using JSON fixture:", err);
    }
  }
  const json = loadJson();
  return { ...json, convexIdBySlug: {} };
}
