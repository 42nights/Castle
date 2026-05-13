/**
 * Shared types. Safe to import from server or client components.
 */

export type Health = "green" | "yellow" | "red";

export type FDERole = "Founder" | "Senior FDE" | "FDE" | "Junior FDE";

export type FDE = {
  id: string;
  name: string;
  role: FDERole;
  is_founder: boolean;
  start_date: string;
  hours_this_week: number;
  capacity_hours_per_week: number;
  agents_shipped_total: number;
  templates_authored: number;
};

export type EngagementPhase = "discovery" | "build" | "deployed" | "support";

export type Engagement = {
  id: string;
  customer_id: string;
  fde_ids: string[];
  start_date: string;
  expected_end_date: string;
  last_update_at: string;
  phase: EngagementPhase;
  progress_pct: number;
  weekly_hours: number;
  health: Health;
  notes: string;
  deployment_ids: string[];
};

export type TemplateCategory = "GTM" | "Ops" | "Content" | "BD" | "Research";

export type Template = {
  id: string;
  name: string;
  category: TemplateCategory;
  capabilities: string[];
  created_at: string;
  origin_customer_id: string;
  authored_by_fde_id: string;
  /** GitHub repo path "<org>/<repo>", e.g. "42nights/deal-flow-scout". */
  github_repo?: string;
};

export type CustomerStatus = "active" | "churned" | "paused";

export type Customer = {
  id: string;
  name: string;
  backed_by: string[];
  start_date: string;
  status: CustomerStatus;
  current_mrr: number;
  is_pe: boolean;
  health: Health;
};

export type Deployment = {
  id: string;
  customer_id: string;
  engagement_id: string;
  template_id: string | null;
  agent_name: string;
  deployed_at: string;
  hours_replaced_per_week: number;
  customization_pct: number;
};

export type PatternExtraction = {
  id: string;
  source_customer_id: string;
  source_engagement_id: string;
  source_engagement_summary: string;
  extracted_into_template_id: string;
  reused_at_customer_ids: string[];
  extracted_at: string;
};

export type FounderHoursEntry = {
  month: string;
  founder_hours_total: number;
  new_arr_dollars: number;
};
