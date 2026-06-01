import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { assertOperator } from "./lib/assertOperator";
import { nowIso } from "./lib/util";
import { authComponent } from "./auth";

/** Create a new organization. Operator-gated. */
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, { name, slug }) => {
    await assertOperator(ctx);
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) throw new Error(`Organization slug "${slug}" already taken.`);
    const id = await ctx.db.insert("organizations", {
      name,
      slug,
      created_at: nowIso(),
    });
    return { id, slug };
  },
});

/** Add a member to an organization. Operator-gated. */
export const addMember = mutation({
  args: {
    organization_id: v.id("organizations"),
    user_id: v.string(),
    role: v.union(v.literal("operator"), v.literal("admin")),
  },
  handler: async (ctx, { organization_id, user_id, role }) => {
    await assertOperator(ctx);
    const existing = await ctx.db
      .query("organization_members")
      .withIndex("by_user", (q) => q.eq("user_id", user_id))
      .filter((q) => q.eq(q.field("organization_id"), organization_id))
      .first();
    if (existing) {
      // Update role if changed; idempotent otherwise.
      if (existing.role !== role) {
        await ctx.db.patch(existing._id, { role });
      }
      return existing._id;
    }
    return ctx.db.insert("organization_members", {
      organization_id,
      user_id,
      role,
      created_at: nowIso(),
    });
  },
});

/** List organizations the calling user is a member of. */
export const listForUser = query({
  args: {},
  handler: async (ctx) => {
    const me = await authComponent.safeGetAuthUser(ctx);
    if (!me?._id) return [];
    const memberships = await ctx.db
      .query("organization_members")
      .withIndex("by_user", (q) => q.eq("user_id", me._id))
      .collect();
    return Promise.all(
      memberships.map(async (m) => {
        const org = await ctx.db.get(m.organization_id);
        return org ? { ...org, role: m.role } : null;
      }),
    ).then((results) => results.filter(Boolean));
  },
});

/**
 * One-shot: create an org and add members in a single mutation. Useful
 * for tests and initial setup. Idempotent — if the slug already exists,
 * returns the existing org.
 */
export const createOrgWithMembers = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    members: v.array(
      v.object({
        user_id: v.string(),
        role: v.union(v.literal("operator"), v.literal("admin")),
      }),
    ),
  },
  handler: async (ctx, { name, slug, members }) => {
    await assertOperator(ctx);
    const now = nowIso();
    let orgId: Id<"organizations">;
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) {
      orgId = existing._id;
    } else {
      orgId = await ctx.db.insert("organizations", { name, slug, created_at: now });
    }
    for (const { user_id, role } of members) {
      const existingMember = await ctx.db
        .query("organization_members")
        .withIndex("by_user", (q) => q.eq("user_id", user_id))
        .filter((q) => q.eq(q.field("organization_id"), orgId))
        .first();
      if (!existingMember) {
        await ctx.db.insert("organization_members", {
          organization_id: orgId,
          user_id,
          role,
          created_at: now,
        });
      } else if (existingMember.role !== role) {
        await ctx.db.patch(existingMember._id, { role });
      }
    }
    return { orgId, slug };
  },
});
