import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { nowIso, slugify, uniqueSlug } from "./lib/util";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Idempotent seed importer. Bails if any fdes already exist.
 *
 * Caller passes a JSON-stringified payload matching the v0 JSON files'
 * shape (see /scripts/seed-convex.mjs). The mutation enforces all
 * referential integrity and materializes junctions
 * (engagement_assignments, template_capabilities, pattern_extraction_reuses).
 *
 * Trigger: `pnpm seed:convex`
 */
export const importPayload = internalMutation({
  args: { payloadJson: v.string() },
  handler: async (ctx, { payloadJson }) => {
    // Check every root table — guarding only on `fdes` means a partial
    // seed (fdes inserted, crash before customers) would never recover,
    // and a manual customer-only insert would let the seed proceed and
    // duplicate rows via uniqueSlug's collision suffix.
    for (const table of [
      "fdes",
      "customers",
      "engagements",
      "templates",
      "deployments",
      "pattern_extractions",
      "founder_hours",
    ] as const) {
      const existing = await ctx.db.query(table).take(1);
      if (existing.length > 0) {
        return {
          skipped: true,
          reason: `${table} already populated — refusing to seed`,
        };
      }
    }
    const payload = JSON.parse(payloadJson) as any;
    const now = nowIso();

    const fdeIdByKey = new Map<string, Id<"fdes">>();
    for (const f of payload.fdes) {
      const slug = await uniqueSlug(ctx, "fdes", slugify(f.id));
      const newId = await ctx.db.insert("fdes", {
        name: f.name,
        role: f.role,
        is_founder: f.is_founder,
        start_date: f.start_date,
        hours_this_week: f.hours_this_week,
        capacity_hours_per_week: f.capacity_hours_per_week,
        agents_shipped_total: f.agents_shipped_total,
        templates_authored: f.templates_authored,
        slug,
        created_at: now,
        updated_at: now,
        updated_by_fde_id: null,
      });
      fdeIdByKey.set(f.id, newId);
    }

    const customerIdByKey = new Map<string, Id<"customers">>();
    for (const c of payload.customers) {
      const slug = await uniqueSlug(ctx, "customers", slugify(c.id));
      const newId = await ctx.db.insert("customers", {
        name: c.name,
        backed_by: c.backed_by,
        start_date: c.start_date,
        status: c.status,
        current_mrr: c.current_mrr,
        is_pe: c.is_pe,
        health: c.health,
        slug,
        created_at: now,
        updated_at: now,
        updated_by_fde_id: null,
      });
      customerIdByKey.set(c.id, newId);
    }

    const engagementIdByKey = new Map<string, Id<"engagements">>();
    for (const e of payload.engagements) {
      const cId = customerIdByKey.get(e.customer_id);
      if (!cId) throw new Error(`bad customer ref ${e.customer_id}`);
      const slug = await uniqueSlug(ctx, "engagements", slugify(e.id));
      const newId = await ctx.db.insert("engagements", {
        customer_id: cId,
        start_date: e.start_date,
        expected_end_date: e.expected_end_date,
        last_update_at: e.last_update_at,
        phase: e.phase,
        progress_pct: e.progress_pct,
        weekly_hours: e.weekly_hours,
        health: e.health,
        notes_current: e.notes,
        notes_version: 1,
        slug,
        created_at: now,
        updated_at: now,
        updated_by_fde_id: null,
      });
      engagementIdByKey.set(e.id, newId);
      for (const fk of e.fde_ids) {
        const fId = fdeIdByKey.get(fk);
        if (!fId) throw new Error(`bad fde ref ${fk}`);
        await ctx.db.insert("engagement_assignments", {
          engagement_id: newId,
          fde_id: fId,
          assigned_at: e.start_date,
          removed_at: null,
          allocation_hours: null,
        });
      }
    }

    const templateIdByKey = new Map<string, Id<"templates">>();
    for (const t of payload.templates) {
      const slug = await uniqueSlug(ctx, "templates", slugify(t.id));
      const origin = customerIdByKey.get(t.origin_customer_id);
      const author = fdeIdByKey.get(t.authored_by_fde_id);
      if (!origin || !author) throw new Error(`bad template refs ${t.id}`);
      const newId = await ctx.db.insert("templates", {
        name: t.name,
        category: t.category,
        origin_customer_id: origin,
        authored_by_fde_id: author,
        slug,
        created_at: t.created_at,
        updated_at: now,
        updated_by_fde_id: null,
      });
      templateIdByKey.set(t.id, newId);
      for (let i = 0; i < t.capabilities.length; i++) {
        await ctx.db.insert("template_capabilities", {
          template_id: newId,
          body: t.capabilities[i],
          position: i + 1,
          created_at: t.created_at,
          updated_at: now,
          updated_by_fde_id: null,
        });
      }
    }

    for (const d of payload.deployments) {
      const c = customerIdByKey.get(d.customer_id);
      const e = engagementIdByKey.get(d.engagement_id);
      const t = d.template_id ? templateIdByKey.get(d.template_id) : null;
      if (!c || !e) throw new Error(`bad deployment refs ${d.id}`);
      await ctx.db.insert("deployments", {
        customer_id: c,
        engagement_id: e,
        template_id: t ?? null,
        agent_name: d.agent_name,
        deployed_at: d.deployed_at,
        hours_replaced_per_week: d.hours_replaced_per_week,
        customization_pct: d.customization_pct,
        created_at: now,
        updated_at: now,
      });
    }

    for (const p of payload.extractions) {
      const sc = customerIdByKey.get(p.source_customer_id);
      const se = engagementIdByKey.get(p.source_engagement_id);
      const tt = templateIdByKey.get(p.extracted_into_template_id);
      if (!sc || !se || !tt) throw new Error(`bad extraction refs ${p.id}`);
      const extractionId = await ctx.db.insert("pattern_extractions", {
        source_customer_id: sc,
        source_engagement_id: se,
        source_engagement_summary: p.source_engagement_summary,
        extracted_into_template_id: tt,
        extracted_at: p.extracted_at,
        created_at: now,
        updated_at: now,
      });
      for (const rk of p.reused_at_customer_ids) {
        const rc = customerIdByKey.get(rk);
        if (!rc) throw new Error(`bad reuse ref ${rk}`);
        await ctx.db.insert("pattern_extraction_reuses", {
          extraction_id: extractionId,
          customer_id: rc,
          added_at: p.extracted_at,
        });
      }
    }

    for (const h of payload.founderHours) {
      await ctx.db.insert("founder_hours", {
        month: h.month,
        founder_hours_total: h.founder_hours_total,
        new_arr_dollars: h.new_arr_dollars,
        created_at: now,
        updated_at: now,
      });
    }

    return { skipped: false };
  },
});
