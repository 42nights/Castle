import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const role = v.union(
  v.literal("Founder"),
  v.literal("Senior FDE"),
  v.literal("FDE"),
  v.literal("Junior FDE"),
);

const health = v.union(
  v.literal("green"),
  v.literal("yellow"),
  v.literal("red"),
);

const customerStatus = v.union(
  v.literal("active"),
  v.literal("churned"),
  v.literal("paused"),
);

const engagementPhase = v.union(
  v.literal("discovery"),
  v.literal("build"),
  v.literal("deployed"),
  v.literal("support"),
);

const templateCategory = v.union(
  v.literal("GTM"),
  v.literal("Ops"),
  v.literal("Content"),
  v.literal("BD"),
  v.literal("Research"),
);

const severity = v.union(
  v.literal("critical"),
  v.literal("high"),
  v.literal("medium"),
);

export default defineSchema({
  fdes: defineTable({
    name: v.string(),
    role,
    is_founder: v.boolean(),
    start_date: v.string(),
    hours_this_week: v.number(),
    capacity_hours_per_week: v.number(),
    agents_shipped_total: v.number(),
    templates_authored: v.number(),
    slug: v.string(),
    /** Free-form skill labels (e.g. "Full Stack", "ML", "Infra").
     *  Multi-tag axis orthogonal to `role` — operators use these for
     *  staffing decisions. Optional so existing rows pre-date the
     *  column; readers default to `[]` at the boundary. */
    tags: v.optional(v.array(v.string())),
    created_at: v.string(),
    updated_at: v.string(),
    updated_by_fde_id: v.union(v.id("fdes"), v.null()),
  }).index("by_slug", ["slug"]),

  customers: defineTable({
    name: v.string(),
    backed_by: v.array(v.string()),
    start_date: v.string(),
    status: customerStatus,
    current_mrr: v.number(),
    is_pe: v.boolean(),
    health,
    slug: v.string(),
    created_at: v.string(),
    updated_at: v.string(),
    updated_by_fde_id: v.union(v.id("fdes"), v.null()),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_health", ["health"]),

  engagements: defineTable({
    customer_id: v.id("customers"),
    start_date: v.string(),
    expected_end_date: v.string(),
    last_update_at: v.string(),
    phase: engagementPhase,
    progress_pct: v.number(),
    weekly_hours: v.number(),
    health,
    notes_current: v.string(),
    notes_version: v.number(),
    slug: v.string(),
    created_at: v.string(),
    updated_at: v.string(),
    updated_by_fde_id: v.union(v.id("fdes"), v.null()),
  })
    .index("by_slug", ["slug"])
    .index("by_customer", ["customer_id"])
    .index("by_phase", ["phase"])
    .index("by_health", ["health"])
    .index("by_last_update", ["last_update_at"]),

  engagement_assignments: defineTable({
    engagement_id: v.id("engagements"),
    fde_id: v.id("fdes"),
    assigned_at: v.string(),
    removed_at: v.union(v.string(), v.null()),
    allocation_hours: v.union(v.number(), v.null()),
  })
    .index("by_engagement", ["engagement_id", "removed_at"])
    .index("by_fde", ["fde_id", "removed_at"])
    .index("by_engagement_fde", ["engagement_id", "fde_id"]),

  deployments: defineTable({
    customer_id: v.id("customers"),
    engagement_id: v.id("engagements"),
    template_id: v.union(v.id("templates"), v.null()),
    agent_name: v.string(),
    deployed_at: v.string(),
    hours_replaced_per_week: v.number(),
    customization_pct: v.number(),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_customer", ["customer_id"])
    .index("by_engagement", ["engagement_id"])
    .index("by_template", ["template_id"]),

  templates: defineTable({
    name: v.string(),
    category: templateCategory,
    origin_customer_id: v.id("customers"),
    authored_by_fde_id: v.id("fdes"),
    slug: v.string(),
    /** GitHub repo under the 42nights org, e.g. "42nights/deal-flow-scout".
     *  Stored as "<org>/<repo>". Used to deep-link to the actual source. */
    github_repo: v.optional(v.string()),
    /** Optional canonical live URL for a deployed instance / demo (e.g.
     *  https://stargazer.42nights.dev). Surfaced alongside the GitHub
     *  link on the template card + detail page. */
    live_url: v.optional(v.string()),
    /** Free-form discovery tags (e.g. "outreach", "github", "stargazer").
     *  Independent of `category` (single enum) — surfaced on the grid
     *  card and detail header, autocomplete from union across templates. */
    tags: v.optional(v.array(v.string())),
    created_at: v.string(),
    updated_at: v.string(),
    updated_by_fde_id: v.union(v.id("fdes"), v.null()),
  })
    .index("by_slug", ["slug"])
    .index("by_category", ["category"]),

  template_capabilities: defineTable({
    template_id: v.id("templates"),
    body: v.string(),
    position: v.number(),
    created_at: v.string(),
    updated_at: v.string(),
    updated_by_fde_id: v.union(v.id("fdes"), v.null()),
  }).index("by_template_position", ["template_id", "position"]),

  pattern_extractions: defineTable({
    source_customer_id: v.id("customers"),
    source_engagement_id: v.id("engagements"),
    source_engagement_summary: v.string(),
    extracted_into_template_id: v.id("templates"),
    extracted_at: v.string(),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_template", ["extracted_into_template_id"])
    .index("by_source_engagement", ["source_engagement_id"]),

  pattern_extraction_reuses: defineTable({
    extraction_id: v.id("pattern_extractions"),
    customer_id: v.id("customers"),
    added_at: v.string(),
  })
    .index("by_extraction_customer", ["extraction_id", "customer_id"])
    .index("by_customer", ["customer_id"]),

  founder_hours: defineTable({
    month: v.string(),
    founder_hours_total: v.number(),
    new_arr_dollars: v.number(),
    created_at: v.string(),
    updated_at: v.string(),
  }).index("by_month", ["month"]),

  engagement_updates: defineTable({
    engagement_id: v.id("engagements"),
    at: v.string(),
    actor_fde_id: v.id("fdes"),
    kind: v.union(
      v.literal("touched"),
      v.literal("phase_change"),
      v.literal("progress"),
      v.literal("reassign"),
      v.literal("note"),
      v.literal("health"),
      v.literal("create"),
      v.literal("delete"),
    ),
    payload_json: v.string(),
  })
    .index("by_engagement", ["engagement_id", "at"])
    .index("by_actor", ["actor_fde_id", "at"]),

  engagement_notes: defineTable({
    engagement_id: v.id("engagements"),
    body: v.string(),
    actor_fde_id: v.id("fdes"),
    client_id: v.string(),
    base_version: v.number(),
    created_at: v.string(),
  })
    .index("by_engagement", ["engagement_id", "created_at"])
    .index("by_client_id", ["client_id"]),

  attention_dismissals: defineTable({
    item_key: v.string(),
    snooze_until: v.string(),
    reason: v.string(),
    dismissed_at: v.string(),
    dismissed_by_fde_id: v.id("fdes"),
  })
    .index("by_item", ["item_key"])
    .index("by_snooze_until", ["snooze_until"]),

  manual_attention_items: defineTable({
    title: v.string(),
    subtitle: v.string(),
    severity,
    owner_fde_id: v.union(v.id("fdes"), v.null()),
    related_customer_id: v.union(v.id("customers"), v.null()),
    related_engagement_id: v.union(v.id("engagements"), v.null()),
    href: v.string(),
    created_at: v.string(),
    updated_at: v.string(),
    updated_by_fde_id: v.union(v.id("fdes"), v.null()),
    resolved_at: v.union(v.string(), v.null()),
    resolved_by_fde_id: v.union(v.id("fdes"), v.null()),
  })
    .index("by_open", ["resolved_at"])
    .index("by_owner_open", ["owner_fde_id", "resolved_at"]),

  /** Per-actor chat conversation. Hermes session name is derived from
   *  the doc id, so each conversation has its own independent memory in
   *  Hermes' session store. */
  agent_conversations: defineTable({
    actor_slug: v.string(),
    title: v.string(),
    /** Hermes session name passed to `--continue`. Computed once on
     *  create and never changed (so the session keeps accumulating). */
    hermes_session: v.string(),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_actor_updated", ["actor_slug", "updated_at"])
    .index("by_hermes_session", ["hermes_session"]),

  /** Castle chat transcript. Hermes itself owns the agent's memory in
   *  its FTS5 session store; this table is purely so the UI can render
   *  what's been said when the page reloads. */
  /** Proposed actions surfaced by the agent — currently just Composio
   *  connection prompts. Each row becomes an inline button in chat. */
  agent_actions: defineTable({
    actor_slug: v.string(),
    kind: v.union(v.literal("composio_connect")),
    /** Toolkit slug for `composio_connect` (e.g. "github"). */
    toolkit: v.string(),
    /** Composio-generated OAuth redirect URL. */
    url: v.string(),
    created_at: v.string(),
    dismissed_at: v.union(v.string(), v.null()),
  })
    .index("by_actor_open", ["actor_slug", "dismissed_at"])
    .index("by_actor_toolkit", ["actor_slug", "toolkit"]),

  agent_messages: defineTable({
    conversation_id: v.id("agent_conversations"),
    actor_slug: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    text: v.string(),
    created_at: v.string(),
  })
    .index("by_conversation_time", ["conversation_id", "created_at"])
    .index("by_actor_time", ["actor_slug", "created_at"]),
});
