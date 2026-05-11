import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { nowIso } from "./lib/util";

const severity = v.union(
  v.literal("critical"),
  v.literal("high"),
  v.literal("medium"),
);

export type AttentionSeverity = "critical" | "high" | "medium";

export type AttentionItem = {
  item_key: string;
  severity: AttentionSeverity;
  title: string;
  subtitle: string;
  owner_fde_id: Id<"fdes"> | null;
  related_customer_id: Id<"customers"> | null;
  related_engagement_id: Id<"engagements"> | null;
  href: string;
  source: "derived" | "manual";
  manual_id?: Id<"manual_attention_items">;
};

const STALL_THRESHOLD_DAYS = 7;
const LONG_DISCOVERY_DAYS = 21;

const sevRank: Record<AttentionSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
};

function daysSince(iso: string, now: number): number {
  const t = Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Math.floor((now - t) / 86400000);
}

export const list = query({
  args: { nowBucket: v.number() },
  handler: async (ctx, { nowBucket }) => {
    const nowMs = nowBucket * 60_000;
    const nowIsoStr = new Date(nowMs).toISOString();

    const customers = await ctx.db.query("customers").collect();
    const engagements = await ctx.db.query("engagements").collect();
    const fdes = await ctx.db.query("fdes").collect();
    const assignments = await ctx.db.query("engagement_assignments").collect();

    const cById = new Map(customers.map((c) => [c._id, c]));
    const fById = new Map(fdes.map((f) => [f._id, f]));

    const items: AttentionItem[] = [];

    // Churn
    for (const c of customers) {
      if (c.status === "churned") {
        items.push({
          item_key: `churn:${c.slug}`,
          severity: "high",
          title: `${c.name} churned`,
          subtitle: `Lost $${(c.current_mrr * 12).toLocaleString()} ARR run-rate. Log a post-mortem and reach-out plan.`,
          owner_fde_id: null,
          related_customer_id: c._id,
          related_engagement_id: null,
          href: `/customers/${c.slug}`,
          source: "derived",
        });
      }
    }

    // Engagement-derived rows
    for (const e of engagements) {
      const customer = cById.get(e.customer_id);
      if (!customer || customer.status === "churned") continue;
      const ownerAssignment = assignments.find(
        (a) => a.engagement_id === e._id && a.removed_at === null,
      );
      const owner = ownerAssignment ? fById.get(ownerAssignment.fde_id) : null;
      const stale = daysSince(e.last_update_at, nowMs);

      if (e.health === "red") {
        items.push({
          item_key: `red-eng:${e.slug}`,
          severity: "critical",
          title: `${customer.name} engagement is red`,
          subtitle: e.notes_current.split(".")[0] + ".",
          owner_fde_id: owner?._id ?? null,
          related_customer_id: customer._id,
          related_engagement_id: e._id,
          href: `/engagements/${e.slug}`,
          source: "derived",
        });
      } else if (e.health === "yellow") {
        items.push({
          item_key: `yellow-eng:${e.slug}`,
          severity: "high",
          title: `${customer.name} flagged yellow`,
          subtitle: e.notes_current.split(".")[0] + ".",
          owner_fde_id: owner?._id ?? null,
          related_customer_id: customer._id,
          related_engagement_id: e._id,
          href: `/engagements/${e.slug}`,
          source: "derived",
        });
      }

      if (e.phase === "discovery") {
        const age = daysSince(e.start_date, nowMs);
        if (age > LONG_DISCOVERY_DAYS) {
          items.push({
            item_key: `disco:${e.slug}`,
            severity: "high",
            title: `${customer.name} stuck in discovery (${age}d)`,
            subtitle:
              "Cut scope or move to build. Discovery beyond 21 days bleeds margin.",
            owner_fde_id: owner?._id ?? null,
            related_customer_id: customer._id,
            related_engagement_id: e._id,
            href: `/engagements/${e.slug}`,
            source: "derived",
          });
        }
      }

      if (stale > STALL_THRESHOLD_DAYS && e.phase !== "support") {
        items.push({
          item_key: `stale-eng:${e.slug}`,
          severity: e.health === "red" ? "critical" : "medium",
          title: `${customer.name} not updated in ${stale}d`,
          subtitle: `Last note ${e.last_update_at}. Either push the work or update the log.`,
          owner_fde_id: owner?._id ?? null,
          related_customer_id: customer._id,
          related_engagement_id: e._id,
          href: `/engagements/${e.slug}`,
          source: "derived",
        });
      }
    }

    // Overcommitted FDEs
    for (const f of fdes) {
      const myActive = assignments
        .filter((a) => a.fde_id === f._id && a.removed_at === null)
        .map((a) => engagements.find((e) => e._id === a.engagement_id))
        .filter(Boolean) as Doc<"engagements">[];
      const liveActive = myActive.filter((e) => {
        const customer = cById.get(e.customer_id);
        return !!customer && customer.status !== "churned";
      });
      if (liveActive.length === 0) continue;
      const committed = liveActive.reduce((sum, e) => {
        const team = assignments.filter(
          (a) => a.engagement_id === e._id && a.removed_at === null,
        ).length;
        return sum + e.weekly_hours / Math.max(1, team);
      }, 0);
      const util = committed / Math.max(1, f.capacity_hours_per_week);
      if (util > 1.05) {
        items.push({
          item_key: `overcommit:${f.slug}`,
          severity: "medium",
          title: `${f.name} overcommitted (${Math.round(util * 100)}%)`,
          subtitle: `Committed ${committed.toFixed(0)}h / ${f.capacity_hours_per_week}h cap. Reassign or push back on a scope.`,
          owner_fde_id: f._id,
          related_customer_id: null,
          related_engagement_id: null,
          href: `/fdes/${f.slug}`,
          source: "derived",
        });
      }
    }

    // Apply dismissals
    const dismissals = await ctx.db.query("attention_dismissals").collect();
    const dismissalByKey = new Map(dismissals.map((d) => [d.item_key, d]));
    const filtered = items.filter((it) => {
      const d = dismissalByKey.get(it.item_key);
      if (!d) return true;
      return d.snooze_until < nowIsoStr; // expired snoozes re-surface
    });

    // Merge open manual items
    const manual = await ctx.db
      .query("manual_attention_items")
      .withIndex("by_open", (q) => q.eq("resolved_at", null))
      .collect();
    for (const m of manual) {
      filtered.push({
        item_key: `manual:${m._id}`,
        severity: m.severity,
        title: m.title,
        subtitle: m.subtitle,
        owner_fde_id: m.owner_fde_id,
        related_customer_id: m.related_customer_id,
        related_engagement_id: m.related_engagement_id,
        href: m.href,
        source: "manual",
        manual_id: m._id,
      });
    }

    filtered.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);
    return filtered;
  },
});

export const listDismissals = query({
  args: {},
  handler: async (ctx) => ctx.db.query("attention_dismissals").collect(),
});

export const snooze = mutation({
  args: {
    item_key: v.string(),
    until: v.string(),
    reason: v.string(),
    actor_fde_id: v.id("fdes"),
  },
  handler: async (ctx, { item_key, until, reason, actor_fde_id }) => {
    const now = nowIso();
    const existing = await ctx.db
      .query("attention_dismissals")
      .withIndex("by_item", (q) => q.eq("item_key", item_key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        snooze_until: until,
        reason,
        dismissed_at: now,
        dismissed_by_fde_id: actor_fde_id,
      });
      return existing._id;
    }
    return ctx.db.insert("attention_dismissals", {
      item_key,
      snooze_until: until,
      reason,
      dismissed_at: now,
      dismissed_by_fde_id: actor_fde_id,
    });
  },
});

export const resolve = mutation({
  args: { item_key: v.string(), actor_fde_id: v.id("fdes") },
  handler: async (ctx, { item_key, actor_fde_id }) => {
    const until = new Date(Date.now() + 365 * 86400000).toISOString();
    const now = nowIso();
    const existing = await ctx.db
      .query("attention_dismissals")
      .withIndex("by_item", (q) => q.eq("item_key", item_key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        snooze_until: until,
        reason: "resolved",
        dismissed_at: now,
        dismissed_by_fde_id: actor_fde_id,
      });
      return existing._id;
    }
    return ctx.db.insert("attention_dismissals", {
      item_key,
      snooze_until: until,
      reason: "resolved",
      dismissed_at: now,
      dismissed_by_fde_id: actor_fde_id,
    });
  },
});

export const clearSnooze = mutation({
  args: { item_key: v.string() },
  handler: async (ctx, { item_key }) => {
    const existing = await ctx.db
      .query("attention_dismissals")
      .withIndex("by_item", (q) => q.eq("item_key", item_key))
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const listManualItems = query({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("manual_attention_items")
      .withIndex("by_open", (q) => q.eq("resolved_at", null))
      .collect(),
});

export const createManualItem = mutation({
  args: {
    title: v.string(),
    subtitle: v.string(),
    severity,
    owner_fde_id: v.union(v.id("fdes"), v.null()),
    related_customer_id: v.union(v.id("customers"), v.null()),
    related_engagement_id: v.union(v.id("engagements"), v.null()),
    href: v.string(),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, args) => {
    const now = nowIso();
    return ctx.db.insert("manual_attention_items", {
      title: args.title,
      subtitle: args.subtitle,
      severity: args.severity,
      owner_fde_id: args.owner_fde_id,
      related_customer_id: args.related_customer_id,
      related_engagement_id: args.related_engagement_id,
      href: args.href,
      created_at: now,
      updated_at: now,
      updated_by_fde_id: args.actor_fde_id,
      resolved_at: null,
      resolved_by_fde_id: null,
    });
  },
});

export const resolveManualItem = mutation({
  args: {
    id: v.id("manual_attention_items"),
    actor_fde_id: v.id("fdes"),
  },
  handler: async (ctx, { id, actor_fde_id }) => {
    const now = nowIso();
    await ctx.db.patch(id, {
      resolved_at: now,
      resolved_by_fde_id: actor_fde_id,
      updated_at: now,
      updated_by_fde_id: actor_fde_id,
    });
  },
});
