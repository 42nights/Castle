import "server-only";

import { fetchQuery } from "convex/nextjs";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
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
 * Requires any valid session. Returns { isOperator } so callers can
 * distinguish guests from operators. Guests pass through here but get
 * restricted access (e.g. read-only templates).
 */
export async function requireSignedIn(): Promise<{ isOperator: boolean }> {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) return { isOperator: true };
  let user: { isOperator?: boolean } | null = null;
  try {
    const { fetchAuthQuery } = await import("@/lib/auth-server");
    user = await fetchAuthQuery(api.auth.getCurrentUser, {});
  } catch (err) {
    if (isRedirectError(err)) throw err;
    throw err;
  }
  if (!user) redirect("/sign-in");
  return { isOperator: user.isOperator ?? false };
}

/**
 * Like requireSignedIn but never redirects. Returns { isOperator: false }
 * for unauthenticated visitors so public pages can render in guest mode.
 */
export async function trySignedIn(): Promise<{ isOperator: boolean }> {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) return { isOperator: true };
  try {
    const { fetchAuthQuery } = await import("@/lib/auth-server");
    const user = await fetchAuthQuery(api.auth.getCurrentUser, {});
    return { isOperator: user?.isOperator ?? false };
  } catch {
    return { isOperator: false };
  }
}

/**
 * Requires an allowlisted operator session. Guests get redirected to
 * /templates (the one area they can access). Unauthenticated users
 * go to /sign-in.
 */
export async function requireOperator(): Promise<void> {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) return;
  // DEV-ONLY auto-operator bypass: skip the redirect so every operator page
  // renders without GitHub OAuth. Gated by CASTLE_DEV_AUTH=1 in .env.local
  // (local only, gitignored). Data still flows via the Convex-side bypass in
  // convex/lib/assertOperator.ts. NEVER set this in production.
  if (process.env.CASTLE_DEV_AUTH === "1") return;
  let user: { isOperator?: boolean } | null = null;
  try {
    const { fetchAuthQuery } = await import("@/lib/auth-server");
    user = await fetchAuthQuery(api.auth.getCurrentUser, {});
  } catch (err) {
    if (isRedirectError(err)) throw err;
    throw err;
  }
  if (!user) redirect("/sign-in");
  if (!user.isOperator) redirect("/templates");
}

export type TemplateData = Omit<LoadedOverview, "founderHours">;

/**
 * Narrower loader for guest-accessible template pages. Returns only
 * the entities templates reference (no founder-hours or other
 * operator-only aggregates). Works for unauthenticated visitors too.
 */
export async function loadTemplateData(): Promise<TemplateData> {
  const full = await loadOverviewUnchecked();
  const { founderHours: _, ...rest } = full;
  return rest;
}

async function loadOverviewUnchecked(): Promise<LoadedOverview> {
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

export async function loadOverview(): Promise<LoadedOverview> {
  await requireOperator();
  return loadOverviewUnchecked();
}
