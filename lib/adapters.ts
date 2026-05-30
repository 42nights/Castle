/**
 * Adapt Convex Doc shapes into the same field names the v0 derive helpers
 * expect (id, fde_ids, notes, capabilities, reused_at_customer_ids).
 *
 * Lets us keep `lib/derive.ts` and the section components unchanged while
 * the data source flips between JSON files and Convex.
 */

import type {
  Customer,
  Deployment,
  Engagement,
  FDE,
  FounderHoursEntry,
  PatternExtraction,
  Template,
} from "./types";

type ConvexDoc<T extends object> = T & { _id: string; _creationTime: number };

type ConvexFde = ConvexDoc<{
  name: string;
  role: FDE["role"];
  is_founder: boolean;
  start_date: string;
  hours_this_week: number;
  capacity_hours_per_week: number;
  agents_shipped_total: number;
  templates_authored: number;
  tags?: string[];
  slug: string;
}>;

type ConvexCustomer = ConvexDoc<{
  name: string;
  backed_by: string[];
  start_date: string;
  status: Customer["status"];
  current_mrr: number;
  is_pe: boolean;
  health: Customer["health"];
  slug: string;
}>;

type ConvexEngagement = ConvexDoc<{
  customer_id: string;
  start_date: string;
  expected_end_date: string;
  last_update_at: string;
  phase: Engagement["phase"];
  progress_pct: number;
  weekly_hours: number;
  health: Engagement["health"];
  notes_current: string;
  notes_version: number;
  slug: string;
}>;

type ConvexAssignment = ConvexDoc<{
  engagement_id: string;
  fde_id: string;
  assigned_at: string;
  removed_at: string | null;
  allocation_hours: number | null;
}>;

type ConvexDeployment = ConvexDoc<{
  customer_id: string;
  engagement_id: string;
  template_id: string | null;
  agent_name: string;
  deployed_at: string;
  hours_replaced_per_week: number;
  customization_pct: number;
}>;

type ConvexTemplate = ConvexDoc<{
  name: string;
  category: Template["category"];
  origin_customer_id: string;
  authored_by_fde_id: string;
  slug: string;
  created_at: string;
  github_repo?: string;
  live_url?: string;
  tags?: string[];
}>;

type ConvexCapability = ConvexDoc<{
  template_id: string;
  body: string;
  position: number;
}>;

type ConvexExtraction = ConvexDoc<{
  source_customer_id: string;
  source_engagement_id: string;
  source_engagement_summary: string;
  extracted_into_template_id: string;
  extracted_at: string;
}>;

type ConvexReuse = ConvexDoc<{
  extraction_id: string;
  customer_id: string;
  added_at: string;
}>;

type ConvexFounderHours = ConvexDoc<{
  month: string;
  founder_hours_total: number;
  new_arr_dollars: number;
}>;

export type ConvexOverview = {
  fdes: ConvexFde[];
  customers: ConvexCustomer[];
  engagements: ConvexEngagement[];
  assignments: ConvexAssignment[];
  deployments: ConvexDeployment[];
  templates: ConvexTemplate[];
  capabilities: ConvexCapability[];
  extractions: ConvexExtraction[];
  reuses: ConvexReuse[];
  founderHours: ConvexFounderHours[];
};

export type AdaptedOverview = {
  fdes: FDE[];
  customers: Customer[];
  engagements: Engagement[];
  templates: Template[];
  deployments: Deployment[];
  patternExtractions: PatternExtraction[];
  founderHours: FounderHoursEntry[];
  /** Map from Convex _id → human slug for any entity, so links keep working. */
  slugById: Record<string, string>;
};

export function adaptOverview(snapshot: ConvexOverview): AdaptedOverview {
  const slugById: Record<string, string> = {};
  for (const f of snapshot.fdes) slugById[f._id] = f.slug;
  for (const c of snapshot.customers) slugById[c._id] = c.slug;
  for (const e of snapshot.engagements) slugById[e._id] = e.slug;
  for (const t of snapshot.templates) slugById[t._id] = t.slug;

  // Build fde_ids per engagement from active assignments
  const fdeSlugsByEng = new Map<string, string[]>();
  for (const a of snapshot.assignments) {
    if (a.removed_at !== null) continue;
    const fdeSlug = slugById[a.fde_id];
    if (!fdeSlug) continue;
    const list = fdeSlugsByEng.get(a.engagement_id) ?? [];
    list.push(fdeSlug);
    fdeSlugsByEng.set(a.engagement_id, list);
  }

  // Build capabilities per template (ordered)
  const capsByTemplate = new Map<string, string[]>();
  for (const c of [...snapshot.capabilities].sort(
    (a, b) => a.position - b.position,
  )) {
    const list = capsByTemplate.get(c.template_id) ?? [];
    list.push(c.body);
    capsByTemplate.set(c.template_id, list);
  }

  // Build reused-at-customer-ids per extraction
  const reusesByExtraction = new Map<string, string[]>();
  for (const r of snapshot.reuses) {
    const cSlug = slugById[r.customer_id];
    if (!cSlug) continue;
    const list = reusesByExtraction.get(r.extraction_id) ?? [];
    list.push(cSlug);
    reusesByExtraction.set(r.extraction_id, list);
  }

  return {
    fdes: snapshot.fdes.map((f) => ({
      id: f.slug,
      name: f.name,
      role: f.role,
      is_founder: f.is_founder,
      start_date: f.start_date,
      hours_this_week: f.hours_this_week,
      capacity_hours_per_week: f.capacity_hours_per_week,
      agents_shipped_total: f.agents_shipped_total,
      templates_authored: f.templates_authored,
      tags: f.tags ?? [],
    })),
    customers: snapshot.customers.map((c) => ({
      id: c.slug,
      name: c.name,
      backed_by: c.backed_by,
      start_date: c.start_date,
      status: c.status,
      current_mrr: c.current_mrr,
      is_pe: c.is_pe,
      health: c.health,
    })),
    engagements: snapshot.engagements.map((e) => ({
      id: e.slug,
      customer_id: slugById[e.customer_id] ?? e.customer_id,
      fde_ids: fdeSlugsByEng.get(e._id) ?? [],
      start_date: e.start_date,
      expected_end_date: e.expected_end_date,
      last_update_at: e.last_update_at,
      phase: e.phase,
      progress_pct: e.progress_pct,
      weekly_hours: e.weekly_hours,
      health: e.health,
      notes: e.notes_current,
      deployment_ids: [],
    })),
    templates: snapshot.templates.map((t) => ({
      id: t.slug,
      name: t.name,
      category: t.category,
      capabilities: capsByTemplate.get(t._id) ?? [],
      created_at: t.created_at,
      origin_customer_id: slugById[t.origin_customer_id] ?? t.origin_customer_id,
      authored_by_fde_id: slugById[t.authored_by_fde_id] ?? t.authored_by_fde_id,
      github_repo: t.github_repo,
      live_url: t.live_url,
      tags: t.tags ?? [],
      archived_at: t.archived_at,
    })),
    deployments: snapshot.deployments.map((d) => ({
      id: d._id,
      customer_id: slugById[d.customer_id] ?? d.customer_id,
      engagement_id: slugById[d.engagement_id] ?? d.engagement_id,
      // If the template was deleted, the FK no longer resolves. Don't
      // leak a raw Convex _id downstream as if it were a slug — that
      // would (a) break "Based on …" links and (b) inflate the
      // "% template-based" metric in customerRows since any non-null
      // template_id counts. Treat orphaned references as fully-custom.
      template_id: d.template_id ? (slugById[d.template_id] ?? null) : null,
      agent_name: d.agent_name,
      deployed_at: d.deployed_at,
      hours_replaced_per_week: d.hours_replaced_per_week,
      customization_pct: d.customization_pct,
    })),
    patternExtractions: snapshot.extractions.map((p) => ({
      id: p._id,
      source_customer_id:
        slugById[p.source_customer_id] ?? p.source_customer_id,
      source_engagement_id:
        slugById[p.source_engagement_id] ?? p.source_engagement_id,
      source_engagement_summary: p.source_engagement_summary,
      extracted_into_template_id:
        slugById[p.extracted_into_template_id] ?? p.extracted_into_template_id,
      reused_at_customer_ids: reusesByExtraction.get(p._id) ?? [],
      extracted_at: p.extracted_at,
    })),
    founderHours: snapshot.founderHours.map((h) => ({
      month: h.month,
      founder_hours_total: h.founder_hours_total,
      new_arr_dollars: h.new_arr_dollars,
    })),
    slugById,
  };
}
