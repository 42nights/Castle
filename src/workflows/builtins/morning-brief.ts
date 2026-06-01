/**
 * Daily morning brief — built-in workflow definition.
 *
 * Fixture data sources are coherent with Castle's seed: Acme Corp and Helio
 * are real seed customers; Jane Liu / Marc Liu are plausible meeting contacts.
 * Data assembly is deterministic so the demo runs reliably without API keys.
 */
import type { WorkflowDefinitionT } from "../schema";

export const morningBriefWorkflow: WorkflowDefinitionT = {
  slug: "daily_morning_brief",
  name: "Daily morning brief",
  description:
    "Every weekday at 7am local. Pulls today's calendar, top open follow-ups, unread starred email, and Castle's attention items. Renders as a digest in chat plus a row in daily_digests.",
  version: "1.0.0",
  default_schedule_cron: "0 7 * * 1-5",
  inputs_schema: {},
  steps: [
    {
      kind: "mcp_call",
      name: "fetch_calendar",
      tool: "google_calendar.list_events",
      args: {
        user_id: "{{__user__}}",
        time_min: "{{__today_start__}}",
        time_max: "{{__today_end__}}",
      },
      save_as: "calendar",
      continue_on_error: false,
    },
    {
      kind: "mcp_call",
      name: "fetch_reminders",
      tool: "list_open_reminders",
      args: {
        user_id: "{{__user__}}",
        due_before: "{{__today_plus_24h__}}",
      },
      save_as: "reminders",
      continue_on_error: false,
    },
    {
      kind: "mcp_call",
      name: "fetch_starred_unread",
      tool: "gmail.list_messages",
      args: {
        user_id: "{{__user__}}",
        query: "is:unread is:starred newer_than:2d",
        max: 10,
      },
      save_as: "starred",
      continue_on_error: true,
    },
    {
      kind: "mcp_call",
      name: "fetch_castle_attention",
      tool: "castle.list_attention",
      args: {
        actor_slug: "{{__castle_actor__}}",
      },
      save_as: "castle_attention",
      continue_on_error: true,
    },
    {
      kind: "llm",
      name: "people_research",
      prompt: `For every external attendee in today's calendar, return a 1-paragraph "who they are" with role, company, last public news. Use the provided LinkedIn / web data only — never invent. JSON list, one per external attendee.
Today's events: {{calendar}}`,
      save_as: "people",
    },
    {
      kind: "llm",
      name: "render_brief",
      prompt: `Compose a morning brief in markdown for {{__user_name__}}.
Sections, in order:
1. Calendar (one line per event, time + title + with whom)
2. People in today's meetings (the people block)
3. Top open follow-ups (count + 3-5 most urgent)
4. Starred unread email (titles + sender + 1-line tldr)
5. Castle attention (1 line per item)
Voice: terse, no preamble, no apology, no "I hope you have a great day".
Inputs:
calendar={{calendar}}
reminders={{reminders}}
starred={{starred}}
castle_attention={{castle_attention}}
people={{people}}`,
      save_as: "brief_md",
    },
    {
      kind: "output",
      name: "emit_digest",
      outcome: {
        type: "digest",
        kind: "morning_brief",
        body_md: "{{brief_md}}",
        structured: {
          calendar_events: "{{calendar}}",
          top_tasks: "{{reminders}}",
          starred: "{{starred}}",
          attention: "{{castle_attention}}",
          people: "{{people}}",
        },
      },
    },
  ],
};
