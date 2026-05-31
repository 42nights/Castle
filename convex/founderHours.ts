import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { nowIso } from "./lib/util";
import { assertOperator } from "./lib/assertOperator";

export const list = query({
  args: {},
  handler: async (ctx) => ctx.db.query("founder_hours").collect(),
});

export const upsertMonth = mutation({
  args: {
    month: v.string(),
    founder_hours_total: v.number(),
    new_arr_dollars: v.number(),
  },
  handler: async (ctx, { month, founder_hours_total, new_arr_dollars }) => {
    // Attempt to get actor email (best-effort — upsertMonth may be called
    // from seed or internal paths without an operator session).
    let actorEmail: string | undefined;
    try {
      const { email } = await assertOperator(ctx);
      actorEmail = email;
    } catch {
      // not operator-gated; allow internal/seed callers
    }

    const now = nowIso();
    const existing = await ctx.db
      .query("founder_hours")
      .withIndex("by_month", (q) => q.eq("month", month))
      .first();

    const prevHours = existing?.founder_hours_total ?? 0;
    const prevArr = existing?.new_arr_dollars ?? 0;
    const hoursDelta = founder_hours_total - prevHours;
    const arrDelta = new_arr_dollars - prevArr;

    let id: string;
    if (existing) {
      await ctx.db.patch(existing._id, {
        founder_hours_total,
        new_arr_dollars,
        updated_at: now,
      });
      id = existing._id;
    } else {
      id = await ctx.db.insert("founder_hours", {
        month,
        founder_hours_total,
        new_arr_dollars,
        created_at: now,
        updated_at: now,
      });
    }

    // P32: Append event row (only if there's an actual change or new row)
    if (!existing || hoursDelta !== 0 || arrDelta !== 0) {
      await ctx.db.insert("founder_hours_events", {
        month,
        kind: "manual",
        founder_hours_delta: hoursDelta,
        new_arr_delta: arrDelta,
        created_at: now,
        created_by_email: actorEmail,
      });
    }

    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("founder_hours") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
