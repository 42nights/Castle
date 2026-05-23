import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { nowIso } from "./lib/util";
import { authComponent } from "./auth";
import {
  isEmailAllowedAgainst,
  RESCUE_ALLOWLIST,
  validatePattern,
} from "../lib/auth-allowlist";

/**
 * Operator check shared across reads and writes. Returns the operator's
 * email if they're allowlisted; null otherwise. The two assert*
 * wrappers below throw on null with consistent error messages.
 *
 * Why read-side too: rejected sign-in attempts contain PII (emails of
 * folks who tried to access Castle). Don't expose them to anonymous
 * callers via `listAttempts`.
 */
async function isOperator(
  ctx: QueryCtx | MutationCtx,
): Promise<string | null> {
  const me = await authComponent.safeGetAuthUser(ctx);
  const email = me?.email;
  if (!email) return null;
  const dynamic = (await ctx.db.query("email_allowlist").collect()).map(
    (r) => r.pattern,
  );
  return isEmailAllowedAgainst(email, dynamic) ? email : null;
}

async function assertOperator(ctx: MutationCtx): Promise<{ email: string }> {
  const email = await isOperator(ctx);
  if (!email) throw new Error("unauthorized: sign in as an allowlisted operator");
  return { email };
}

async function assertOperatorRead(
  ctx: QueryCtx,
): Promise<{ email: string }> {
  const email = await isOperator(ctx);
  if (!email) throw new Error("unauthorized: sign in as an allowlisted operator");
  return { email };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Email allowlist CRUD. Read-side is open to any signed-in operator
 * (the auth gate already restricts who can hit Castle at all). Write
 * side is the same — we don't have separate roles right now, so any
 * allowlisted user can edit the list. Rescue patterns from
 * lib/auth-allowlist.ts are NOT stored in this table but are surfaced
 * read-only in `listWithRescue`.
 */

export const list = query({
  args: {},
  handler: async (ctx) => {
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

export const add = mutation({
  args: {
    pattern: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { pattern, note }) => {
    const { email } = await assertOperator(ctx);
    const cleaned = validatePattern(pattern);

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

    return ctx.db.insert("email_allowlist", {
      pattern: cleaned,
      note: note?.trim() || undefined,
      created_at: nowIso(),
      created_by_email: email,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("email_allowlist") },
  handler: async (ctx, { id }) => {
    await assertOperator(ctx);
    const row = await ctx.db.get(id);
    if (!row) throw new Error("Pattern already gone.");
    await ctx.db.delete(id);
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
