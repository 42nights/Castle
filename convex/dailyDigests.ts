import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { nowIso } from "./lib/util";

// ─────────────────────────────────────────────────────────────────────────────
// Type contract for sections_json payload (shared with the view layer)
// ─────────────────────────────────────────────────────────────────────────────
// Intentionally co-located with the mutation so the seed and the renderer
// stay in sync without a shared lib file.

export type DigestSections = {
  weather: string; // one-line company weather summary
  metrics: {
    mrr: string;
    arr: string;
    activeEngagements: number;
    attentionCount: number;
  };
  calendar: Array<{
    time: string; // "9:00 AM"
    title: string;
    tag: "internal" | "external" | "tier-1" | "investor";
    location?: string;
  }>;
  people: Array<{
    name: string;
    title: string;
    context: string;
  }>;
  followUps: Array<{
    title: string;
    dueDate: string; // "Jun 2"
    done: boolean;
  }>;
  attention: Array<{
    title: string;
    subtitle: string;
    severity: "critical" | "high" | "medium";
    href: string;
  }>;
  starredUnread: Array<{
    sender: string;
    subject: string;
    preview: string;
  }>;
};

/**
 * Upsert a daily digest row. Idempotent on (user_id, date) — if a row
 * already exists for the day, it is replaced with fresh content.
 */
export const upsertToday = mutation({
  args: {
    user_id: v.string(),
    date: v.string(), // YYYY-MM-DD
    markdown: v.string(),
    sections_json: v.optional(v.string()),
    workflow_run_id: v.optional(v.id("workflow_runs")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("daily_digests")
      .withIndex("by_user_date", (q) =>
        q.eq("user_id", args.user_id).eq("date", args.date),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        markdown: args.markdown,
        ...(args.sections_json !== undefined
          ? { sections_json: args.sections_json }
          : {}),
        ...(args.workflow_run_id !== undefined
          ? { workflow_run_id: args.workflow_run_id }
          : {}),
      });
      return existing._id;
    }

    const id = await ctx.db.insert("daily_digests", {
      user_id: args.user_id,
      date: args.date,
      markdown: args.markdown,
      ...(args.sections_json !== undefined
        ? { sections_json: args.sections_json }
        : {}),
      ...(args.workflow_run_id !== undefined
        ? { workflow_run_id: args.workflow_run_id }
        : {}),
      created_at: nowIso(),
    });
    return id;
  },
});

/** Return the latest digest for a user (most recent by date). */
export const latestForUser = query({
  args: { user_id: v.string() },
  handler: async (ctx, { user_id }) => {
    return ctx.db
      .query("daily_digests")
      .withIndex("by_user_date", (q) => q.eq("user_id", user_id))
      .order("desc")
      .first();
  },
});

/** Return all digests for a user, descending. */
export const listForUser = query({
  args: { user_id: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { user_id, limit }) => {
    return ctx.db
      .query("daily_digests")
      .withIndex("by_user_date", (q) => q.eq("user_id", user_id))
      .order("desc")
      .take(limit ?? 10);
  },
});

/**
 * Return the most recent digest across ALL users — used as a dev-mode
 * fallback so the /assistant page always renders something in the dev
 * bypass session regardless of which user_id the auth layer returns.
 */
export const mostRecent = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("daily_digests")
      .order("desc")
      .first();
  },
});

/**
 * Seed today's digest for the dev-operator user (2026-06-01).
 * Idempotent — safe to run multiple times; always replaces the row.
 * Invoked via: npx convex run dailyDigests:seedTodayDigest '{}'
 */
export const seedTodayDigest = mutation({
  args: {},
  handler: async (ctx) => {
    const USER_ID = "dev-operator";
    const DATE = "2026-06-01";

    const sections: DigestSections = {
      weather:
        "2 engagements red, MRR steady at $41.2k, Otis shipped at Northwind — integration live.",
      metrics: {
        mrr: "$41,200",
        arr: "$494,400",
        activeEngagements: 7,
        attentionCount: 3,
      },
      calendar: [
        {
          time: "9:00 AM",
          title: "Team standup — Ayaan, Jerry, Idan",
          tag: "internal",
          location: "Castle HQ",
        },
        {
          time: "10:30 AM",
          title: "Cendol Commerce — weekly check-in",
          tag: "tier-1",
          location: "Zoom",
        },
        {
          time: "12:00 PM",
          title: "Investor sync — Raj Patel (Sequoia Seed)",
          tag: "investor",
          location: "Sequoia offices",
        },
        {
          time: "2:00 PM",
          title: "Brightwell Logistics — Otis voice regression review",
          tag: "tier-1",
          location: "Google Meet",
        },
        {
          time: "4:30 PM",
          title: "Northwind Foods — post-launch debrief",
          tag: "external",
          location: "Zoom",
        },
      ],
      people: [
        {
          name: "Priya Nair",
          title: "Head of Operations, Cendol Commerce",
          context:
            "Runs all internal tooling decisions. Recently escalated the voice regression on the Otis pipeline — wants a fix timeline today.",
        },
        {
          name: "Raj Patel",
          title: "Partner, Sequoia Seed",
          context:
            "Led the $1.8M seed round. Quarterly sync — will ask about engagement count and pipeline health. Positive on the Northwind win.",
        },
        {
          name: "Marcus Webb",
          title: "CTO, Brightwell Logistics",
          context:
            "Technical decision-maker. Sponsored the Otis deployment. Has a standing ask for observability dashboards by end of Q2.",
        },
      ],
      followUps: [
        {
          title: "Send Brightwell Logistics post-launch summary doc",
          dueDate: "Jun 2",
          done: false,
        },
        {
          title: "Reply to Cendol: voice regression ETA",
          dueDate: "Today",
          done: false,
        },
        {
          title: "Draft Sequoia investor update (Q2 metrics)",
          dueDate: "Jun 3",
          done: false,
        },
        {
          title: "Merge Jerry's FDE capacity refactor PR",
          dueDate: "Jun 2",
          done: false,
        },
      ],
      attention: [
        {
          title: "Cendol Commerce — health red",
          subtitle:
            "Voice regression on Otis pipeline reported 3 days ago; no fix shipped.",
          severity: "critical",
          href: "/engagements",
        },
        {
          title: "42nights internal — overdue update",
          subtitle: "Engagement notes stale for 9 days. Last touched by Jerry.",
          severity: "critical",
          href: "/engagements",
        },
        {
          title: "Cendol voice regression — incident open",
          subtitle:
            "P1 ticket unresolved. Ayaan is lead; ETA not set.",
          severity: "high",
          href: "/engagements",
        },
      ],
      starredUnread: [
        {
          sender: "Priya Nair",
          subject: "Re: Otis pipeline — voice regression",
          preview:
            "Hi Idan — we're blocked on the batch ingest step. Can we get a call today before the Brightwell debrief?",
        },
        {
          sender: "Raj Patel",
          subject: "Sequoia Q2 check-in — prep notes",
          preview:
            "Looking forward to today. A few things I want to cover: ARR trajectory, team capacity, and the new FDE hiring plan.",
        },
        {
          sender: "Jerry Kim",
          subject: "PR #214 ready for review",
          preview:
            "Refactored the capacity model — reduced query count by 60%. Ready when you have 10 min.",
        },
      ],
    };

    const markdown = `# Morning Brief — Monday, June 1, 2026

**Company weather:** ${sections.weather}

## Metrics
- MRR: ${sections.metrics.mrr}
- ARR: ${sections.metrics.arr}
- Active engagements: ${sections.metrics.activeEngagements}
- Attention items: ${sections.metrics.attentionCount}

## Today's calendar
${sections.calendar.map((e) => `- **${e.time}** — ${e.title}`).join("\n")}

## Open follow-ups
${sections.followUps.map((f) => `- [ ] ${f.title} *(due ${f.dueDate})*`).join("\n")}

## Castle attention
${sections.attention.map((a) => `- **${a.title}** — ${a.subtitle}`).join("\n")}

---
*Generated 6:00 AM · Castle + Hermes*`;

    const existing = await ctx.db
      .query("daily_digests")
      .withIndex("by_user_date", (q) =>
        q.eq("user_id", USER_ID).eq("date", DATE),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        markdown,
        sections_json: JSON.stringify(sections),
      });
      return existing._id;
    }

    return await ctx.db.insert("daily_digests", {
      user_id: USER_ID,
      date: DATE,
      markdown,
      sections_json: JSON.stringify(sections),
      created_at: "2026-06-01T06:00:00.000Z",
    });
  },
});
