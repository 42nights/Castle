import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * Dynamic chat empty-state suggestions.
 *
 * Replaces the hardcoded `SUGGESTIONS` array in components/chat-landing.tsx.
 * The empty state is just prompt seeds — clicking prefills the input and
 * Hermes runs the actual query on send. So we don't need to *answer* the
 * questions here; we just need to surface questions Hermes can answer,
 * mentioning entities that are interesting right now.
 *
 * Cadences stacked from the caller:
 *   - nowBucket      (per-minute) — same trigger pattern as attention.list
 *   - rotationBucket (per-day)    — daily variety
 *   - mountSeed      (per-mount)  — different five each new chat / refresh
 *
 * The query reads live state, builds candidates from a typed template
 * catalog, scores + dedupes + deterministic-shuffles, and returns the
 * top 5 prompt strings. Fills with evergreens when state is sparse.
 */

const STALL_THRESHOLD_DAYS = 7;
const LONG_DISCOVERY_DAYS = 21;

function daysSince(iso: string, now: number): number {
  const ms = now - new Date(iso).getTime();
  return Math.floor(ms / 86_400_000);
}

// Small deterministic hash so we can tiebreak within a score band without
// pulling crypto in. djb2 — good enough for shuffle, terrible for security.
function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

type Severity = "critical" | "high" | "medium";

type Candidate = {
  // Stable id for dedupe-by-entity + tiebreak hash. Customer slug, fde
  // slug, engagement slug, or a synthetic key for global prompts.
  entityKey: string;
  // Score = template.priority + boost from candidate severity / recency.
  // Higher wins.
  score: number;
  // Final rendered prompt string.
  prompt: string;
};

type TemplateOut = {
  id: string;
  candidates: Candidate[];
};

// Evergreens always get returned at the bottom of the score band so they
// fill empty slots without crowding genuinely interesting state out.
const EVERGREEN_PROMPTS: string[] = [
  "what did i ask you to remember last time?",
  "remember: jerry prefers terse one-line answers",
  "summarize today across all engagements",
  "which template are we reusing the most?",
  "what's the highest-ROI deployment we shipped?",
];
const EVERGREEN_BASE_SCORE = 1; // lower than any real-signal template

export const list = query({
  args: {
    nowBucket: v.number(),
    rotationBucket: v.number(),
    mountSeed: v.number(),
  },
  handler: async (ctx, { nowBucket, rotationBucket, mountSeed }) => {
    void nowBucket; // trigger only; we use Date.now for actual math
    const nowMs = Date.now();

    const customers = await ctx.db.query("customers").collect();
    const engagements = await ctx.db.query("engagements").collect();
    const fdes = await ctx.db.query("fdes").collect();
    const assignments = await ctx.db
      .query("engagement_assignments")
      .collect();
    const deployments = await ctx.db.query("deployments").collect();
    const founderHours = await ctx.db.query("founder_hours").collect();
    const dismissals = await ctx.db
      .query("attention_dismissals")
      .collect();
    const manualItems = await ctx.db
      .query("manual_attention_items")
      .withIndex("by_open", (q) => q.eq("resolved_at", null))
      .collect();

    const cById = new Map(customers.map((c) => [c._id, c]));
    const cBySlug = new Map(customers.map((c) => [c.slug, c]));
    void cBySlug;
    const dismissalByKey = new Map(dismissals.map((d) => [d.item_key, d]));
    const nowIsoStr = new Date(nowMs).toISOString();
    const isLiveDismissal = (key: string) => {
      const d = dismissalByKey.get(key);
      return d ? d.snooze_until >= nowIsoStr : false;
    };

    // Live (non-churned) customers' engagements only — derive most signals
    // from this slice.
    const liveEngagements = engagements.filter((e) => {
      const c = cById.get(e.customer_id);
      return !!c && c.status !== "churned";
    });

    const outputs: TemplateOut[] = [];

    // ─────────────────── Signal templates ───────────────────

    // red-now: global prompt; one candidate iff there's >=1 red engagement.
    const reds = liveEngagements.filter((e) => e.health === "red");
    if (reds.length > 0) {
      outputs.push({
        id: "red-now",
        candidates: [
          {
            entityKey: "global:red-now",
            score: 100,
            prompt: "what's red right now?",
          },
        ],
      });
    }

    // red-customer-why: one candidate per red engagement.
    if (reds.length > 0) {
      outputs.push({
        id: "red-customer-why",
        candidates: reds
          .map((e) => {
            const c = cById.get(e.customer_id);
            if (!c) return null;
            return {
              entityKey: `customer:${c.slug}`,
              score: 95,
              prompt: `why is ${c.name} red, and what's the next move?`,
            };
          })
          .filter((x): x is Candidate => x !== null),
      });
    }

    // yellow-recover: one global prompt iff >=1 yellow.
    const yellows = liveEngagements.filter((e) => e.health === "yellow");
    if (yellows.length > 0) {
      outputs.push({
        id: "yellow-recover",
        candidates: [
          {
            entityKey: "global:yellow-recover",
            score: 70,
            prompt: "what's yellow that could move green this week?",
          },
        ],
      });
    }

    // stale-update: global prompt if >=1 stale.
    const stales = liveEngagements.filter(
      (e) =>
        e.phase !== "support" &&
        daysSince(e.last_update_at, nowMs) > STALL_THRESHOLD_DAYS,
    );
    if (stales.length > 0) {
      outputs.push({
        id: "stale-update",
        candidates: [
          {
            entityKey: "global:stale-update",
            score: 65,
            prompt: `what engagements haven't been updated in over ${STALL_THRESHOLD_DAYS} days?`,
          },
        ],
      });
    }

    // discovery-stuck: per-customer prompt where discovery > 21d.
    const discoStuck = liveEngagements.filter(
      (e) =>
        e.phase === "discovery" &&
        daysSince(e.start_date, nowMs) > LONG_DISCOVERY_DAYS,
    );
    if (discoStuck.length > 0) {
      outputs.push({
        id: "discovery-stuck",
        candidates: discoStuck
          .map((e) => {
            const c = cById.get(e.customer_id);
            if (!c) return null;
            return {
              entityKey: `customer:${c.slug}`,
              score: 75,
              prompt: `why is ${c.name} stuck in discovery?`,
            };
          })
          .filter((x): x is Candidate => x !== null),
      });
    }

    // snooze-attention: per open attention item (manual + derived not yet
    // dismissed). We sample from the manual items (those carry a real
    // related_customer_id so the prompt reads cleanly).
    const openManualWithCustomer = manualItems
      .map((m) => {
        if (!m.related_customer_id) return null;
        const c = cById.get(m.related_customer_id as Id<"customers">);
        if (!c) return null;
        return { customer: c, severity: m.severity };
      })
      .filter((x): x is { customer: Doc<"customers">; severity: Severity } => x !== null);
    if (openManualWithCustomer.length > 0) {
      outputs.push({
        id: "snooze-attention",
        candidates: openManualWithCustomer.map((x) => ({
          entityKey: `customer:${x.customer.slug}`,
          score: 55,
          prompt: `snooze ${x.customer.name}'s attention item for 7 days`,
        })),
      });
    }

    // customer-snapshot: any active customer. Lower priority — useful
    // when state is otherwise calm.
    const activeCustomers = customers.filter((c) => c.status === "active");
    if (activeCustomers.length > 0) {
      outputs.push({
        id: "customer-snapshot",
        candidates: activeCustomers.map((c) => ({
          entityKey: `customer:${c.slug}`,
          score: 30,
          prompt: `show ${c.name}'s MRR, health, and active deployments`,
        })),
      });
    }

    // FDE utilization
    type FdeUtil = {
      fde: Doc<"fdes">;
      util: number;
      committed: number;
    };
    const fdeUtils: FdeUtil[] = [];
    for (const f of fdes) {
      const myActive = assignments
        .filter((a) => a.fde_id === f._id && a.removed_at === null)
        .map((a) => engagements.find((e) => e._id === a.engagement_id))
        .filter(Boolean) as Doc<"engagements">[];
      const liveActive = myActive.filter((e) => {
        const c = cById.get(e.customer_id);
        return !!c && c.status !== "churned";
      });
      if (liveActive.length === 0) continue;
      const committed = liveActive.reduce((sum, e) => {
        const team = assignments.filter(
          (a) => a.engagement_id === e._id && a.removed_at === null,
        ).length;
        return sum + e.weekly_hours / Math.max(1, team);
      }, 0);
      const util = committed / Math.max(1, f.capacity_hours_per_week);
      fdeUtils.push({ fde: f, util, committed });
    }

    const overcommitted = fdeUtils.filter((u) => u.util > 1.05);

    // overcommitted (global)
    if (overcommitted.length > 0) {
      outputs.push({
        id: "overcommitted",
        candidates: [
          {
            entityKey: "global:overcommitted",
            score: 80,
            prompt: "which FDEs are over capacity?",
          },
        ],
      });
    }

    // rebalance-fde: one candidate per overcommitted FDE.
    if (overcommitted.length > 0) {
      outputs.push({
        id: "rebalance-fde",
        candidates: overcommitted.map((u) => ({
          entityKey: `fde:${u.fde.slug}`,
          score: 60,
          prompt: `rebalance ${u.fde.name}'s active work`,
        })),
      });
    }

    // utilization-board: global, needs >=2 FDEs with active work.
    if (fdeUtils.length >= 2) {
      outputs.push({
        id: "utilization-board",
        candidates: [
          {
            entityKey: "global:utilization-board",
            score: 25,
            prompt: "list FDE utilization by active customer",
          },
        ],
      });
    }

    // top-deployments: any deployment replacing >5h/wk.
    const heavyDeployments = deployments.filter(
      (d) => d.hours_replaced_per_week >= 5,
    );
    if (heavyDeployments.length > 0) {
      outputs.push({
        id: "top-deployments",
        candidates: [
          {
            entityKey: "global:top-deployments",
            score: 20,
            prompt: "which deployments replace the most hours per week?",
          },
        ],
      });
    }

    // founder-hours-roi: needs >=2 founder_hours rows.
    if (founderHours.length >= 2) {
      outputs.push({
        id: "founder-hours-roi",
        candidates: [
          {
            entityKey: "global:founder-hours-roi",
            score: 15,
            prompt: "where are founder hours least efficient?",
          },
        ],
      });
    }

    // Reserved (suppresses any signal-based prompt referencing a
    // currently-snoozed attention item).
    void isLiveDismissal;

    // ─────────────────── Scoring + dedupe + shuffle ───────────────────

    // Cap one candidate per template (best score wins within template),
    // then cap one per entity globally so we don't surface the same
    // customer in two slots.
    const pickedByTemplate: Candidate[] = [];
    for (const t of outputs) {
      if (t.candidates.length === 0) continue;
      // Sort by score desc, deterministic hash tie-break.
      const sorted = [...t.candidates].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const ha = djb2(
          `${t.id}|${a.entityKey}|${rotationBucket}|${mountSeed}`,
        );
        const hb = djb2(
          `${t.id}|${b.entityKey}|${rotationBucket}|${mountSeed}`,
        );
        return ha - hb;
      });
      pickedByTemplate.push(sorted[0]);
    }

    // Sort templates by score (desc), tiebreak by hash. Cap by entity.
    pickedByTemplate.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ha = djb2(`${a.entityKey}|${rotationBucket}|${mountSeed}`);
      const hb = djb2(`${b.entityKey}|${rotationBucket}|${mountSeed}`);
      return ha - hb;
    });

    const finalPrompts: { id: string; prompt: string }[] = [];
    const usedEntities = new Set<string>();
    for (const c of pickedByTemplate) {
      // Allow each "global:" bucket through (no entity collision), but
      // dedupe actual customer / fde mentions.
      if (!c.entityKey.startsWith("global:") && usedEntities.has(c.entityKey)) {
        continue;
      }
      usedEntities.add(c.entityKey);
      finalPrompts.push({ id: c.entityKey, prompt: c.prompt });
      if (finalPrompts.length >= 5) break;
    }

    // Fill remaining slots with evergreens. Stable order via the same
    // hash so we don't show the same evergreen first every time.
    if (finalPrompts.length < 5) {
      const shuffled = [...EVERGREEN_PROMPTS].sort((a, b) => {
        const ha = djb2(`evergreen|${a}|${rotationBucket}|${mountSeed}`);
        const hb = djb2(`evergreen|${b}|${rotationBucket}|${mountSeed}`);
        return ha - hb;
      });
      void EVERGREEN_BASE_SCORE;
      for (const p of shuffled) {
        if (finalPrompts.length >= 5) break;
        finalPrompts.push({ id: `evergreen:${djb2(p)}`, prompt: p });
      }
    }

    return finalPrompts;
  },
});
