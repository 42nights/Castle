import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { nowIso } from "./lib/util";
import { assertOperator, assertOperatorRead } from "./lib/assertOperator";
import {
  isEmailAllowedAgainst,
  matchesPattern,
  RESCUE_ALLOWLIST,
  validatePattern,
} from "../lib/auth-allowlist";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Email allowlist CRUD. Both reads and writes require an operator
 * session (guests must not enumerate who has admin access). Rescue
 * patterns from lib/auth-allowlist.ts are surfaced read-only in
 * `listWithRescue`.
 */

export const list = query({
  args: {},
  handler: async (ctx) => {
    await assertOperatorRead(ctx);
    const rows = await ctx.db.query("email_allowlist").collect();
    return rows
      .map((r) => ({
        id: r._id,
        pattern: r.pattern,
        note: r.note ?? null,
        created_at: r.created_at,
        created_by_email: r.created_by_email ?? null,
        kind: r.pattern.startsWith("*@")
          ? ("domain" as const)
          : ("email" as const),
        source: "dynamic" as const,
      }))
      .sort((a, b) => a.pattern.localeCompare(b.pattern));
  },
});

/** Returns rescue (hardcoded) patterns alongside dynamic ones, so the
 *  settings UI can show "these are baked into the codebase" rows that
 *  can't be removed. */
export const listWithRescue = query({
  args: {},
  handler: async (ctx) => {
    await assertOperatorRead(ctx);
    const rows = await ctx.db.query("email_allowlist").collect();
    const dynamic = rows.map((r) => ({
      id: r._id as string | null,
      pattern: r.pattern,
      note: r.note ?? null,
      created_at: r.created_at,
      created_by_email: r.created_by_email ?? null,
      kind: r.pattern.startsWith("*@")
        ? ("domain" as const)
        : ("email" as const),
      source: "dynamic" as const,
    }));
    const rescue = RESCUE_ALLOWLIST.map((p) => ({
      id: null,
      pattern: p,
      note: "rescue — hardcoded in lib/auth-allowlist.ts",
      created_at: "",
      created_by_email: null,
      kind: p.startsWith("*@") ? ("domain" as const) : ("email" as const),
      source: "rescue" as const,
    }));
    return [...rescue, ...dynamic].sort((a, b) =>
      a.pattern.localeCompare(b.pattern),
    );
  },
});

/** Patterns array — what convex/auth.ts hook compares against. */
export const patternsForCheck = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("email_allowlist").collect();
    return rows.map((r) => r.pattern);
  },
});

/** Rate-limit constant: max adds per actor per 60s window. */
const ADD_RATE_LIMIT = 20;
const ADD_WINDOW_MS = 60_000;

export const add = mutation({
  args: {
    pattern: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { pattern, note }) => {
    const { email } = await assertOperator(ctx);
    const cleaned = validatePattern(pattern);

    // Rate-limit: count how many this actor added in the last 60s
    const windowStart = new Date(Date.now() - ADD_WINDOW_MS).toISOString();
    const recentAdds = await ctx.db
      .query("email_allowlist_audit")
      .withIndex("by_at")
      .order("desc")
      .collect();
    const actorRecent = recentAdds.filter(
      (r) => r.action === "add" && r.actor_email === email && r.at >= windowStart,
    );
    if (actorRecent.length >= ADD_RATE_LIMIT) {
      throw new Error(
        `Rate limit: you've added ${ADD_RATE_LIMIT} patterns in the last 60s. Wait before adding more.`,
      );
    }

    const existing = await ctx.db
      .query("email_allowlist")
      .withIndex("by_pattern", (q) => q.eq("pattern", cleaned))
      .unique();
    if (existing) {
      throw new Error(`"${cleaned}" is already on the allowlist.`);
    }
    if (RESCUE_ALLOWLIST.includes(cleaned)) {
      throw new Error(`"${cleaned}" is already a hardcoded rescue entry.`);
    }

    const id = await ctx.db.insert("email_allowlist", {
      pattern: cleaned,
      note: note?.trim() || undefined,
      created_at: nowIso(),
      created_by_email: email,
    });

    // Audit
    await ctx.db.insert("email_allowlist_audit", {
      pattern: cleaned,
      action: "add",
      actor_email: email,
      at: nowIso(),
    });

    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("email_allowlist") },
  handler: async (ctx, { id }) => {
    const { email } = await assertOperator(ctx);
    const row = await ctx.db.get(id);
    if (!row) throw new Error("Pattern already gone.");

    // Audit before delete so we have the pattern
    await ctx.db.insert("email_allowlist_audit", {
      pattern: row.pattern,
      action: "remove",
      actor_email: email,
      at: nowIso(),
    });

    await ctx.db.delete(id);
  },
});

/** Batch insert patterns. Silently skips duplicates (idempotent). */
export const addBulk = mutation({
  args: {
    patterns: v.array(v.string()),
  },
  handler: async (ctx, { patterns }) => {
    const { email } = await assertOperator(ctx);
    const now = nowIso();
    let inserted = 0;
    let skipped = 0;
    for (const raw of patterns) {
      let cleaned: string;
      try {
        cleaned = validatePattern(raw);
      } catch {
        skipped++;
        continue;
      }
      if (RESCUE_ALLOWLIST.includes(cleaned)) {
        skipped++;
        continue;
      }
      const existing = await ctx.db
        .query("email_allowlist")
        .withIndex("by_pattern", (q) => q.eq("pattern", cleaned))
        .unique();
      if (existing) {
        skipped++;
        continue;
      }
      await ctx.db.insert("email_allowlist", {
        pattern: cleaned,
        created_at: now,
        created_by_email: email,
      });
      await ctx.db.insert("email_allowlist_audit", {
        pattern: cleaned,
        action: "add",
        actor_email: email,
        at: now,
      });
      inserted++;
    }
    return { inserted, skipped };
  },
});

/** Returns which pattern matches (dynamic OR rescue) for a given email, or null. */
export const testEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    await assertOperatorRead(ctx);
    const dynamic = await ctx.db.query("email_allowlist").collect();
    for (const row of dynamic) {
      if (matchesPattern(email, row.pattern)) {
        return { matched_pattern: row.pattern, source: "dynamic" as const };
      }
    }
    for (const p of RESCUE_ALLOWLIST) {
      if (matchesPattern(email, p)) {
        return { matched_pattern: p, source: "rescue" as const };
      }
    }
    return null;
  },
});

/** Last 50 audit rows ordered newest first. */
export const listAudit = query({
  args: {},
  handler: async (ctx) => {
    await assertOperatorRead(ctx);
    return ctx.db
      .query("email_allowlist_audit")
      .withIndex("by_at")
      .order("desc")
      .take(50);
  },
});

/* ────────────────── rejected sign-in attempts ────────────────── */

/**
 * Internal mutation called by `convex/auth.ts`'s user.create.before
 * hook when an email is rejected by the allowlist. Best-effort —
 * the caller wraps in try/catch so a write failure here can't mask
 * the access_denied error from getting back to the user.
 *
 * Dedupes by normalized_email: repeat denials bump attempt_count +
 * last_attempted_at on the same row, so the inbox stays compact.
 */
export const logDenied = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return;
    const now = nowIso();
    const existing = await ctx.db
      .query("access_attempts")
      .withIndex("by_normalized_email", (q) =>
        q.eq("normalized_email", normalized),
      )
      .unique();
    if (existing) {
      // If already approved or dismissed, treat the new attempt as a
      // fresh denial — reset outcome to "denied" so it resurfaces.
      await ctx.db.patch(existing._id, {
        outcome: "denied",
        last_attempted_at: now,
        attempt_count: existing.attempt_count + 1,
        resolved_at: undefined,
        resolved_by_email: undefined,
      });
      return;
    }
    await ctx.db.insert("access_attempts", {
      email,
      normalized_email: normalized,
      outcome: "denied",
      first_attempted_at: now,
      last_attempted_at: now,
      attempt_count: 1,
    });
  },
});

/** Operator-only. Bounded to 50 most-recent denied attempts. */
export const listAttempts = query({
  args: {},
  handler: async (ctx) => {
    await assertOperatorRead(ctx);
    const rows = await ctx.db
      .query("access_attempts")
      .withIndex("by_outcome_attempted", (q) => q.eq("outcome", "denied"))
      .order("desc")
      .take(50);
    return rows.map((r) => ({
      id: r._id,
      email: r.email,
      attempt_count: r.attempt_count,
      first_attempted_at: r.first_attempted_at,
      last_attempted_at: r.last_attempted_at,
    }));
  },
});

/**
 * Approve a rejected attempt. Idempotent:
 *  - If the row is already resolved, no-op (don't error).
 *  - If the email is already covered by some other pattern
 *    (dynamic ∪ rescue), mark resolved without inserting a duplicate.
 *  - Otherwise insert an exact-email pattern, mark resolved.
 */
export const approveAttempt = mutation({
  args: { id: v.id("access_attempts") },
  handler: async (ctx, { id }) => {
    const { email: operatorEmail } = await assertOperator(ctx);
    const row = await ctx.db.get(id);
    if (!row) throw new Error("Attempt no longer exists.");
    if (row.outcome !== "denied") return; // already handled

    const now = nowIso();
    const dynamic = (await ctx.db.query("email_allowlist").collect()).map(
      (r) => r.pattern,
    );

    // If some pattern already covers this email, just mark resolved.
    if (isEmailAllowedAgainst(row.email, dynamic)) {
      await ctx.db.patch(id, {
        outcome: "approved",
        resolved_at: now,
        resolved_by_email: operatorEmail,
      });
      return;
    }

    // Otherwise add the exact email as a dynamic pattern (defensive:
    // re-check uniqueness to avoid a race with manual add).
    const cleaned = normalizeEmail(row.email);
    const existingPattern = await ctx.db
      .query("email_allowlist")
      .withIndex("by_pattern", (q) => q.eq("pattern", cleaned))
      .unique();
    if (!existingPattern && !RESCUE_ALLOWLIST.includes(cleaned)) {
      await ctx.db.insert("email_allowlist", {
        pattern: cleaned,
        note: `approved from sign-in attempt`,
        created_at: now,
        created_by_email: operatorEmail,
      });
    }
    await ctx.db.patch(id, {
      outcome: "approved",
      resolved_at: now,
      resolved_by_email: operatorEmail,
    });
  },
});

/** Mark an attempt dismissed (hide from inbox). Doesn't blacklist. */
export const dismissAttempt = mutation({
  args: { id: v.id("access_attempts") },
  handler: async (ctx, { id }) => {
    const { email: operatorEmail } = await assertOperator(ctx);
    const row = await ctx.db.get(id);
    if (!row) throw new Error("Attempt no longer exists.");
    if (row.outcome !== "denied") return;
    await ctx.db.patch(id, {
      outcome: "dismissed",
      resolved_at: nowIso(),
      resolved_by_email: operatorEmail,
    });
  },
});
