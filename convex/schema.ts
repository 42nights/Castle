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
    /** Soft-delete. ISO timestamp when archived; absent = active.
     *  Archived templates are hidden from ALL list views (operators
     *  included) and from guest direct access; operators reach them via
     *  the archived view (templates.listArchived) to restore. */
    archived_at: v.optional(v.string()),
    created_at: v.string(),
    updated_at: v.string(),
    updated_by_fde_id: v.union(v.id("fdes"), v.null()),
  })
    .index("by_slug", ["slug"])
    .index("by_category", ["category"]),

  /** Repositories discovered in the 42nights GitHub org via the
   *  Composio sync job, but not yet promoted to a real template. Each
   *  row is a single repo; deduped by `github_repo`. Operators can
   *  promote a candidate (open the create-template dialog and link the
   *  github_repo) or dismiss it. Promoted/dismissed rows stay around
   *  for audit + to keep the sync job idempotent. */
  template_github_candidates: defineTable({
    /** "<org>/<repo>", e.g. "42nights/deal-flow-scout". Lowercased. */
    github_repo: v.string(),
    /** Repo name as returned by GitHub (no org prefix). */
    name: v.string(),
    description: v.optional(v.string()),
    discovered_at: v.string(),
    dismissed_at: v.optional(v.string()),
    promoted_to_template_id: v.optional(v.id("templates")),
  })
    .index("by_repo", ["github_repo"])
    .index("by_discovered", ["discovered_at"]),

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
   *  Hermes' session store.
   *
   *  Visibility model: `personal` rows are only visible to / writable
   *  by their `owner_user_id` (Better Auth user id). `shared` rows are
   *  visible + writable to any allowlisted user. Both fields are
   *  optional so the migration can backfill them; readers default to
   *  `personal` + owner-by-actor_slug for legacy rows. */
  agent_conversations: defineTable({
    actor_slug: v.string(),
    title: v.string(),
    /** Hermes session name passed to `--continue`. Computed once on
     *  create and never changed (so the session keeps accumulating).
     *  Personal chats use the prefix `castle-personal-{owner}-...` and
     *  shared chats use `castle-shared-...` so the FTS5 session store
     *  is naturally partitioned. */
    hermes_session: v.string(),
    /** "personal" (only owner sees it) or "shared" (any allowlisted
     *  operator). Optional during migration; treat absent as
     *  "personal". */
    visibility: v.optional(v.union(v.literal("personal"), v.literal("shared"))),
    /** Better Auth user id of the creator. Optional during migration;
     *  treat absent as legacy/unowned (excluded from listings). */
    owner_user_id: v.optional(v.string()),
    /** U6 sidebar V2 — pinned conversations sort to the top (cap 5).
     *  Absent = not pinned. */
    pinned_at: v.optional(v.string()),
    /** U6 sidebar V2 — archived conversations hide from the main list.
     *  Absent = active. */
    archived_at: v.optional(v.string()),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_actor_updated", ["actor_slug", "updated_at"])
    .index("by_hermes_session", ["hermes_session"])
    .index("by_owner_updated", ["owner_user_id", "updated_at"])
    .index("by_visibility_updated", ["visibility", "updated_at"]),

  /** Castle chat transcript. Hermes itself owns the agent's memory in
   *  its FTS5 session store; this table is purely so the UI can render
   *  what's been said when the page reloads. */
  /** Proposed actions surfaced by the agent. Two families:
   *  - `composio_connect`: an OAuth connect prompt (legacy; `toolkit` +
   *    `url` are set, the propose_* fields are absent).
   *  - `propose_mutation`: the agent wants to run a state-changing Castle
   *    MCP tool (e.g. engagement_delete, customer_set_health) and is
   *    asking the operator to confirm first. The UI renders this as an
   *    ActionCard with verb/target/reason/side-effects + accept/reject.
   *    On accept the server runs `tool_name(payload_json)` and opens a
   *    10s undo window (`undo_until`). See convex/agentActions.ts.
   *
   *  All propose_* fields are optional so existing composio_connect rows
   *  validate unchanged. */
  agent_actions: defineTable({
    actor_slug: v.string(),
    kind: v.union(
      v.literal("composio_connect"),
      v.literal("propose_mutation"),
    ),
    /** Toolkit slug for `composio_connect` (e.g. "github"). */
    toolkit: v.string(),
    /** Composio-generated OAuth redirect URL (composio_connect only). */
    url: v.string(),
    created_at: v.string(),
    dismissed_at: v.union(v.string(), v.null()),
    // ── propose_mutation fields (all optional) ────────────────────────
    /** The Castle MCP tool the agent wants to run, e.g.
     *  "engagement_mark_touched". */
    tool_name: v.optional(v.string()),
    /** Human verb shown on the card header, e.g. "Mark touched". */
    verb: v.optional(v.string()),
    /** What the action targets, e.g. "Acme support engagement". */
    target: v.optional(v.string()),
    /** One-line rationale the agent gives for the action. */
    reason: v.optional(v.string()),
    /** Bullet list of side effects shown before accept. */
    side_effects: v.optional(v.array(v.string())),
    /** JSON-stringified args passed to `tool_name` on accept. */
    payload_json: v.optional(v.string()),
    /** The turn that proposed this (gates "belongs to current turn"). */
    created_by_turn_id: v.optional(v.id("agent_turns")),
    /** ISO; after this the card greys out as "expired" (~5 min). */
    expires_at: v.optional(v.string()),
    /** "accepted" | "rejected" | "dismissed" | "expired" once resolved. */
    resolved_outcome: v.optional(
      v.union(
        v.literal("accepted"),
        v.literal("rejected"),
        v.literal("dismissed"),
        v.literal("expired"),
      ),
    ),
    resolved_at: v.optional(v.string()),
    /** ISO; while now < undo_until the accept can be reversed. */
    undo_until: v.optional(v.string()),
    /** JSON-stringified result of the executed mutation (for the chip). */
    result_json: v.optional(v.string()),
  })
    .index("by_actor_open", ["actor_slug", "dismissed_at"])
    .index("by_actor_toolkit", ["actor_slug", "toolkit"])
    .index("by_turn", ["created_by_turn_id"]),

  agent_messages: defineTable({
    conversation_id: v.id("agent_conversations"),
    actor_slug: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    text: v.string(),
    /** Status of an assistant turn while streaming. Absent on user rows
     *  and on pre-migration assistant rows — readers treat absent as
     *  "complete" for backward compat. */
    status: v.optional(
      v.union(
        v.literal("streaming"),
        v.literal("complete"),
        v.literal("failed"),
        v.literal("canceled"),
      ),
    ),
    /** Back-pointer to the agent_turns row that produced this message.
     *  Absent on user rows and pre-migration assistant rows. */
    turn_id: v.optional(v.id("agent_turns")),
    /** Files the operator attached when sending this message. Stored as
     *  Convex storage ids — resolve to public URLs via `storage.getUrl`
     *  on demand. Absent on assistant rows and any user message sent
     *  without attachments. */
    attachments: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          name: v.string(),
          contentType: v.optional(v.string()),
          size: v.optional(v.number()),
        }),
      ),
    ),
    created_at: v.string(),
    updated_at: v.optional(v.string()),
  })
    .index("by_conversation_time", ["conversation_id", "created_at"])
    .index("by_actor_time", ["actor_slug", "created_at"]),

  /** One row per assistant turn — tracks lifecycle (queued → running →
   *  complete/failed/canceled), heartbeat for stuck-detection, and
   *  back-links to the user + assistant agent_messages rows. */
  agent_turns: defineTable({
    conversation_id: v.id("agent_conversations"),
    actor_slug: v.string(),
    user_message_id: v.id("agent_messages"),
    assistant_message_id: v.id("agent_messages"),
    hermes_session: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("complete"),
      v.literal("failed"),
      v.literal("canceled"),
    ),
    started_at: v.string(),
    last_heartbeat_at: v.string(),
    completed_at: v.optional(v.string()),
    stop_reason: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_conversation", ["conversation_id"])
    .index("by_status_heartbeat", ["status", "last_heartbeat_at"]),

  /** Append-only text deltas during streaming. Coalesced at ~500ms in
   *  the wrapper. Final text is snapshotted into agent_messages.text on
   *  turn complete; the chunks can be reaped later. */
  agent_message_chunks: defineTable({
    turn_id: v.id("agent_turns"),
    seq: v.number(),
    delta: v.string(),
    created_at: v.string(),
  }).index("by_turn_seq", ["turn_id", "seq"]),

  /** Email allowlist — operators can add/remove patterns from the
   *  Settings → Access page. Pattern is either a full email or a
   *  domain wildcard like "*@example.com". The Better Auth user-create
   *  hook in `convex/auth.ts` checks against this table on every
   *  sign-in. A hardcoded rescue list in `lib/auth-allowlist.ts` is
   *  always merged so we can't lock ourselves out by emptying it. */
  email_allowlist: defineTable({
    pattern: v.string(),
    note: v.optional(v.string()),
    created_at: v.string(),
    created_by_email: v.optional(v.string()),
  }).index("by_pattern", ["pattern"]),

  /** Rejected sign-in attempts. Better Auth's user.create.before hook
   *  logs every denied attempt here so an operator can see the exact
   *  email GitHub returned and one-click approve it from
   *  /settings/access. Dedupe by normalized_email — repeat denials
   *  bump attempt_count + last_attempted_at on the same row. */
  access_attempts: defineTable({
    email: v.string(),
    normalized_email: v.string(),
    outcome: v.union(
      v.literal("denied"),
      v.literal("approved"),
      v.literal("dismissed"),
    ),
    first_attempted_at: v.string(),
    last_attempted_at: v.string(),
    attempt_count: v.number(),
    resolved_at: v.optional(v.string()),
    resolved_by_email: v.optional(v.string()),
  })
    .index("by_normalized_email", ["normalized_email"])
    .index("by_outcome_attempted", ["outcome", "last_attempted_at"]),

  /** Append-only tool / thought events during streaming.
   *
   *  `tool_result` is the structured-output event the chat's tool-result
   *  renderer consumes (§4.9): when a tool call completes, Hermes emits a
   *  `tool_result` row carrying the JSON-stringified result in
   *  `result_json` keyed by `tool_call_id`. The UI's renderer registry
   *  (lib/tool-renderers.ts) decodes it by `name` into a table / cards /
   *  kanban / chip view instead of a JSON dump. Old clients that don't
   *  know the kind simply ignore the row, so the addition is additive. */
  agent_tool_events: defineTable({
    turn_id: v.id("agent_turns"),
    seq: v.number(),
    kind: v.union(
      v.literal("thought"),
      v.literal("tool_start"),
      v.literal("tool_end"),
      v.literal("tool_result"),
    ),
    tool_call_id: v.optional(v.string()),
    name: v.optional(v.string()),
    ok: v.optional(v.boolean()),
    delta: v.optional(v.string()),
    /** JSON-stringified structured result for `tool_result` events.
     *  Absent on thought / tool_start / tool_end rows. */
    result_json: v.optional(v.string()),
    created_at: v.string(),
  }).index("by_turn_seq", ["turn_id", "seq"]),

  // ───────────────────────────────────────────────────────────────────
  //  P-phase additive tables (P26 audit, P27 sync, P32 event-sourcing)
  // ───────────────────────────────────────────────────────────────────

  /** P26 — append-only audit of email_allowlist changes. Every add /
   *  remove writes a row here so /settings/access can show "recent
   *  changes" even after the underlying pattern row is gone. */
  email_allowlist_audit: defineTable({
    pattern: v.string(),
    action: v.union(v.literal("add"), v.literal("remove")),
    actor_email: v.optional(v.string()),
    at: v.string(),
  }).index("by_at", ["at"]),

  /** P27 — one row per GitHub→templates sync run. The `lock_token` +
   *  `completed_at === null` pair is the idempotency lock (CAS): a second
   *  concurrent sync sees an unfinished run and 409s. */
  template_sync_runs: defineTable({
    started_at: v.string(),
    completed_at: v.union(v.string(), v.null()),
    source: v.union(v.literal("cron"), v.literal("manual"), v.literal("webhook")),
    actor_email: v.optional(v.string()),
    count_seen: v.number(),
    count_inserted: v.number(),
    count_skipped: v.number(),
    error: v.optional(v.string()),
    lock_token: v.optional(v.string()),
  })
    .index("by_started", ["started_at"])
    .index("by_open", ["completed_at"]),

  /** P32 — append-only event log behind founder_hours. Each manual
   *  upsert or derive-check writes an event; the founder_hours row is the
   *  materialized fold. Lets us show a manual-vs-derived overlay and
   *  surface drift in the attention queue. */
  founder_hours_events: defineTable({
    month: v.string(),
    kind: v.union(v.literal("manual"), v.literal("derived")),
    founder_hours_delta: v.number(),
    new_arr_delta: v.number(),
    source_ref: v.optional(v.string()),
    created_at: v.string(),
    created_by_email: v.optional(v.string()),
  }).index("by_month", ["month"]),

  /** U8 — last-seen tracking for the chat empty state (first-time vs
   *  returning-operator welcome). Keyed by Better Auth user id. */
  user_state: defineTable({
    user_id: v.string(),
    last_seen_at: v.string(),
  }).index("by_user", ["user_id"]),

  // ───────────────────────────────────────────────────────────────────
  //  AI Personal Assistant (A0) — assistant_* namespace. Lives in the
  //  same Convex deployment as Castle, prefix-isolated. Most demo value
  //  is the morning-brief → daily_digests path; the rest is scaffolding
  //  so the workflow engine + chat are real, not faked.
  // ───────────────────────────────────────────────────────────────────

  /** Per-user assistant chat thread. Hermes session name uses the
   *  `assistant-personal-{user}-{conv}` prefix so the FTS5 store is
   *  partitioned away from Castle's `castle-*` sessions and from other
   *  users (no cross-user memory leak). */
  assistant_conversations: defineTable({
    user_id: v.string(),
    title: v.string(),
    hermes_session: v.string(),
    created_at: v.string(),
    updated_at: v.string(),
    archived_at: v.optional(v.string()),
  })
    .index("by_user_updated", ["user_id", "updated_at"])
    .index("by_hermes_session", ["hermes_session"]),

  assistant_messages: defineTable({
    conversation_id: v.id("assistant_conversations"),
    user_id: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    text: v.string(),
    status: v.optional(
      v.union(
        v.literal("streaming"),
        v.literal("complete"),
        v.literal("failed"),
        v.literal("canceled"),
      ),
    ),
    turn_id: v.optional(v.id("assistant_turns")),
    created_at: v.string(),
    updated_at: v.optional(v.string()),
  }).index("by_conversation_time", ["conversation_id", "created_at"]),

  assistant_turns: defineTable({
    conversation_id: v.id("assistant_conversations"),
    user_id: v.string(),
    user_message_id: v.id("assistant_messages"),
    assistant_message_id: v.id("assistant_messages"),
    hermes_session: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("complete"),
      v.literal("failed"),
      v.literal("canceled"),
    ),
    started_at: v.string(),
    last_heartbeat_at: v.string(),
    completed_at: v.optional(v.string()),
    stop_reason: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_conversation", ["conversation_id"])
    .index("by_status_heartbeat", ["status", "last_heartbeat_at"]),

  assistant_message_chunks: defineTable({
    turn_id: v.id("assistant_turns"),
    seq: v.number(),
    delta: v.string(),
    created_at: v.string(),
  }).index("by_turn_seq", ["turn_id", "seq"]),

  assistant_tool_events: defineTable({
    turn_id: v.id("assistant_turns"),
    seq: v.number(),
    kind: v.union(
      v.literal("thought"),
      v.literal("tool_start"),
      v.literal("tool_end"),
      v.literal("tool_result"),
    ),
    tool_call_id: v.optional(v.string()),
    name: v.optional(v.string()),
    ok: v.optional(v.boolean()),
    delta: v.optional(v.string()),
    result_json: v.optional(v.string()),
    created_at: v.string(),
  }).index("by_turn_seq", ["turn_id", "seq"]),

  /** A workflow definition — built-in (source="builtin", loaded from
   *  disk on startup) or user-authored YAML. `definition_json` is the
   *  validated step graph (see src/workflows/schema.ts). */
  assistant_workflows: defineTable({
    user_id: v.union(v.string(), v.null()), // null = global built-in
    slug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    source: v.union(v.literal("builtin"), v.literal("user")),
    definition_json: v.string(),
    enabled: v.boolean(),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_slug", ["slug"])
    .index("by_user", ["user_id"]),

  workflow_schedules: defineTable({
    user_id: v.string(),
    workflow_slug: v.string(),
    cron: v.string(),
    timezone: v.string(),
    paused: v.boolean(),
    next_fire_at: v.string(),
    last_fired_at: v.optional(v.string()),
    created_at: v.string(),
  })
    .index("by_next_fire", ["paused", "next_fire_at"])
    .index("by_user", ["user_id"]),

  workflow_runs: defineTable({
    user_id: v.string(),
    workflow_slug: v.string(),
    trigger: v.union(
      v.literal("manual"),
      v.literal("scheduled"),
      v.literal("event"),
    ),
    status: v.union(
      v.literal("running"),
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("awaiting_confirmation"),
    ),
    steps_json: v.string(),
    error: v.optional(v.string()),
    started_at: v.string(),
    finished_at: v.optional(v.string()),
  })
    .index("by_user_started", ["user_id", "started_at"])
    .index("by_workflow", ["workflow_slug"]),

  /** The morning-brief output (demo beat 10). One row per user per day. */
  daily_digests: defineTable({
    user_id: v.string(),
    date: v.string(), // YYYY-MM-DD
    markdown: v.string(),
    sections_json: v.optional(v.string()),
    workflow_run_id: v.optional(v.id("workflow_runs")),
    created_at: v.string(),
  })
    .index("by_user_date", ["user_id", "date"]),

  /** Cross-product telemetry receiver (§9.9). Sibling products POST events
   *  to /api/deployments/{id}/events; this table is the append-only store.
   *  `payload` is JSON.stringify of the full event body — stored opaquely so
   *  any per-kind shape variation from the five emitters is forward-compatible.
   *  `deployment_id` is the raw Castle deployment _id string as sent by the
   *  emitter; stored as string because it arrives externally and may not
   *  resolve to a live row (fire-and-forget telemetry). */
  deployment_events: defineTable({
    deployment_id: v.string(),
    kind: v.string(),
    payload: v.string(),
    received_at: v.string(),
  })
    .index("by_deployment_received", ["deployment_id", "received_at"])
    .index("by_kind", ["kind"]),

  /** Per-user recently viewed entities. Capped at 10 per user (by slug),
   *  deduped so repeated visits just bump viewed_at. Surfaced in the
   *  command palette's default list and (later) in the overview
   *  "pick up where you left off" strip. */
  user_recents: defineTable({
    user_id: v.string(),
    kind: v.union(
      v.literal("customer"),
      v.literal("engagement"),
      v.literal("fde"),
      v.literal("template"),
      v.literal("extraction"),
    ),
    slug: v.string(),
    title: v.string(),
    viewed_at: v.string(),
  })
    .index("by_user_viewed", ["user_id", "viewed_at"])
    .index("by_user_slug", ["user_id", "slug"]),

  user_preferences: defineTable({
    user_id: v.string(),
    timezone: v.string(),
    working_hours_json: v.optional(v.string()),
    deep_work_blocks_json: v.optional(v.string()),
    email_send_policy: v.union(v.literal("always"), v.literal("draft_only")),
    sensitive_scrub_patterns_json: v.optional(v.string()),
    personal_context_blurb: v.optional(v.string()),
    created_at: v.string(),
    updated_at: v.string(),
  }).index("by_user", ["user_id"]),

  capture_inbox: defineTable({
    user_id: v.string(),
    body: v.string(),
    source: v.union(
      v.literal("chat"),
      v.literal("email"),
      v.literal("manual"),
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("processed"),
      v.literal("dismissed"),
    ),
    extraction_json: v.optional(v.string()),
    resulting_reminder_ids: v.optional(v.array(v.id("follow_up_reminders"))),
    created_at: v.string(),
  }).index("by_user_status", ["user_id", "status"]),

  follow_up_reminders: defineTable({
    user_id: v.string(),
    title: v.string(),
    due_at: v.string(),
    context: v.optional(v.string()),
    status: v.union(
      v.literal("open"),
      v.literal("done"),
      v.literal("snoozed"),
    ),
    created_at: v.string(),
  })
    .index("by_user_due", ["user_id", "due_at"])
    .index("by_user_status", ["user_id", "status"]),
});
