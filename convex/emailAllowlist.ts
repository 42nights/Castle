import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { nowIso } from "./lib/util";
import { authComponent } from "./auth";
import {
  isEmailAllowedAgainst,
  RESCUE_ALLOWLIST,
  validatePattern,
} from "../lib/auth-allowlist";

/**
 * Convex public mutations can be called by anyone who knows the URL —
 * not just our /settings/access page. Without this check, an
 * unauthenticated caller could add their own pattern and then sign in.
 * We require a signed-in Better Auth user whose email is itself on the
 * (dynamic ∪ rescue) allowlist.
 */
async function assertOperator(ctx: MutationCtx): Promise<{ email: string }> {
  const me = await authComponent.safeGetAuthUser(ctx);
  const email = me?.email;
  if (!email) throw new Error("unauthorized: sign in first");
  const dynamic = (await ctx.db.query("email_allowlist").collect()).map(
    (r) => r.pattern,
  );
  if (!isEmailAllowedAgainst(email, dynamic)) {
    throw new Error("unauthorized: your email is not on the allowlist");
  }
  return { email };
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
