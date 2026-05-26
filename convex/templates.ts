import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertOperator, assertOperatorRead } from "./lib/assertOperator";
import { nowIso, slugify, uniqueSlug } from "./lib/util";

const category = v.union(
  v.literal("GTM"),
  v.literal("Ops"),
  v.literal("Content"),
  v.literal("BD"),
  v.literal("Research"),
);

export const list = query({
  args: {},
  handler: async (ctx) => ctx.db.query("templates").collect(),
});

// ────────────────────── GitHub candidates ──────────────────────────

/** Active candidates — discovered repos that haven't been promoted to
 *  a real template or dismissed yet. The /templates page surfaces
 *  these so an operator can decide which to turn into templates. */
export const listGithubCandidates = query({
  args: {},
  handler: async (ctx) => {
    await assertOperatorRead(ctx);
    const rows = await ctx.db
      .query("template_github_candidates")
      .withIndex("by_discovered")
      .order("desc")
      .collect();
    return rows.filter((r) => !r.dismissed_at && !r.promoted_to_template_id);
  },
});

/** Idempotent upsert: insert a candidate if its github_repo isn't
 *  already on file (active OR resolved), no-op otherwise. Returns the
 *  resulting row id and a flag for whether it was newly inserted.
 *  Called by the GitHub sync route on each repo. */
export const upsertGithubCandidate = mutation({
  args: {
    github_repo: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertOperator(ctx);
    const repo = args.github_repo.toLowerCase();
    const existing = await ctx.db
      .query("template_github_candidates")
      .withIndex("by_repo", (q) => q.eq("github_repo", repo))
      .first();
    if (existing) return { id: existing._id, inserted: false };
    // Also skip if a template already links to this repo.
    const linkedTemplate = await ctx.db
      .query("templates")
      .filter((q) => q.eq(q.field("github_repo"), repo))
      .first();
    if (linkedTemplate) return { id: null, inserted: false } as const;
    const id = await ctx.db.insert("template_github_candidates", {
      github_repo: repo,
      name: args.name,
      description: args.description,
      discovered_at: nowIso(),
    });
    return { id, inserted: true };
  },
});

export const dismissGithubCandidate = mutation({
  args: { id: v.id("template_github_candidates") },
  handler: async (ctx, { id }) => {
    await assertOperator(ctx);
    await ctx.db.patch(id, { dismissed_at: nowIso() });
  },
});

export const markCandidatePromoted = mutation({
  args: {
    id: v.id("template_github_candidates"),
    template_id: v.id("templates"),
  },
  handler: async (ctx, { id, template_id }) => {
    await assertOperator(ctx);
    await ctx.db.patch(id, { promoted_to_template_id: template_id });
  },
});

export const listCapabilities = query({
  args: { template_id: v.id("templates") },
  handler: async (ctx, { template_id }) =>
    ctx.db
      .query("template_capabilities")
      .withIndex("by_template_position", (q) =>
        q.eq("template_id", template_id),
      )
      .collect(),
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) =>
    ctx.db
      .query("templates")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first(),
});

export const create = mutation({
  args: {
    name: v.string(),
    category,
    capabilities: v.array(v.string()),
    origin_customer_id: v.id("customers"),
    authored_by_fde_id: v.id("fdes"),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, args) => {
    await assertOperator(ctx);
    const slug = await uniqueSlug(ctx, "templates", slugify(args.name));
    const now = nowIso();
    const id = await ctx.db.insert("templates", {
      name: args.name,
      category: args.category,
      origin_customer_id: args.origin_customer_id,
      authored_by_fde_id: args.authored_by_fde_id,
      slug,
      created_at: now,
      updated_at: now,
      updated_by_fde_id: args.actor_fde_id,
    });
    for (let i = 0; i < args.capabilities.length; i++) {
      await ctx.db.insert("template_capabilities", {
        template_id: id,
        body: args.capabilities[i],
        position: i + 1,
        created_at: now,
        updated_at: now,
        updated_by_fde_id: args.actor_fde_id,
      });
    }
    return { id, slug };
  },
});

export const update = mutation({
  args: {
    id: v.id("templates"),
    patch: v.object({
      name: v.optional(v.string()),
      category: v.optional(category),
      tags: v.optional(v.array(v.string())),
      // Operator may need to retroactively fix attribution — pick the
      // wrong FDE or wrong customer at create time, etc.
      origin_customer_id: v.optional(v.id("customers")),
      authored_by_fde_id: v.optional(v.id("fdes")),
    }),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, { id, patch, actor_fde_id }) => {
    await assertOperator(ctx);
    const cleaned: typeof patch = patch.tags
      ? {
          ...patch,
          tags: Array.from(
            new Set(
              patch.tags.map((t) => t.trim()).filter((t) => t && t !== "—"),
            ),
          ),
        }
      : patch;
    await ctx.db.patch(id, {
      ...cleaned,
      updated_at: nowIso(),
      updated_by_fde_id: actor_fde_id,
    });
  },
});

/** Set the GitHub repo path for a template. Accepts forms like
 *  "42nights/repo", "https://github.com/42nights/repo", or
 *  "github.com/42nights/repo". Stored as the canonical "owner/repo"
 *  shape. Pass null/empty to clear. */
export const setGithubRepo = mutation({
  args: {
    id: v.id("templates"),
    repo: v.union(v.string(), v.null()),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, { id, repo, actor_fde_id }) => {
    await assertOperator(ctx);
    let normalized: string | null = null;
    if (repo) {
      const m = repo
        .trim()
        .replace(/^https?:\/\/(www\.)?github\.com\//, "")
        .replace(/^github\.com\//, "")
        .replace(/\.git$/, "")
        .replace(/\/$/, "");
      if (!/^[\w.-]+\/[\w.-]+$/.test(m)) {
        throw new Error("Expected '<owner>/<repo>' or a github.com URL");
      }
      normalized = m;
    }
    await ctx.db.patch(id, {
      github_repo: normalized ?? undefined,
      updated_at: nowIso(),
      updated_by_fde_id: actor_fde_id,
    });
  },
});

/** Set the live URL for a template. Pass null/empty to clear.
 *  Normalises to include https:// if a bare domain was pasted. */
export const setLiveUrl = mutation({
  args: {
    id: v.id("templates"),
    url: v.union(v.string(), v.null()),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, { id, url, actor_fde_id }) => {
    await assertOperator(ctx);
    let normalized: string | null = null;
    if (url) {
      const trimmed = url.trim();
      if (trimmed) {
        const withScheme = /^https?:\/\//i.test(trimmed)
          ? trimmed
          : `https://${trimmed}`;
        try {
          // Validate via URL parser — throws on garbage.
          new URL(withScheme);
        } catch {
          throw new Error("Expected a valid URL (e.g. https://example.com)");
        }
        normalized = withScheme;
      }
    }
    await ctx.db.patch(id, {
      live_url: normalized ?? undefined,
      updated_at: nowIso(),
      updated_by_fde_id: actor_fde_id,
    });
  },
});

// ─────────────── template tags ───────────────

function cleanTags(tags: string[]): string[] {
  return Array.from(
    new Set(tags.map((t) => t.trim()).filter((t) => t && t !== "—")),
  );
}

export const setTags = mutation({
  args: {
    id: v.id("templates"),
    tags: v.array(v.string()),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, { id, tags, actor_fde_id }) => {
    await assertOperator(ctx);
    await ctx.db.patch(id, {
      tags: cleanTags(tags),
      updated_at: nowIso(),
      updated_by_fde_id: actor_fde_id,
    });
  },
});

export const addTag = mutation({
  args: {
    id: v.id("templates"),
    tag: v.string(),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, { id, tag, actor_fde_id }) => {
    await assertOperator(ctx);
    const tpl = await ctx.db.get(id);
    if (!tpl) throw new Error("Template not found");
    const next = cleanTags([...(tpl.tags ?? []), tag]);
    await ctx.db.patch(id, {
      tags: next,
      updated_at: nowIso(),
      updated_by_fde_id: actor_fde_id,
    });
  },
});

export const removeTag = mutation({
  args: {
    id: v.id("templates"),
    tag: v.string(),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, { id, tag, actor_fde_id }) => {
    await assertOperator(ctx);
    const tpl = await ctx.db.get(id);
    if (!tpl) throw new Error("Template not found");
    const needle = tag.trim().toLowerCase();
    const next = (tpl.tags ?? []).filter(
      (t) => t.trim().toLowerCase() !== needle,
    );
    await ctx.db.patch(id, {
      tags: next,
      updated_at: nowIso(),
      updated_by_fde_id: actor_fde_id,
    });
  },
});

export const listTags = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("templates").collect();
    const set = new Set<string>();
    for (const t of all) {
      for (const tag of t.tags ?? []) {
        const trimmed = tag.trim();
        if (trimmed && trimmed !== "—") set.add(trimmed);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  },
});

export const addCapability = mutation({
  args: {
    template_id: v.id("templates"),
    body: v.string(),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, { template_id, body, actor_fde_id }) => {
    await assertOperator(ctx);
    const last = await ctx.db
      .query("template_capabilities")
      .withIndex("by_template_position", (q) =>
        q.eq("template_id", template_id),
      )
      .order("desc")
      .first();
    const position = (last?.position ?? 0) + 1;
    const now = nowIso();
    return ctx.db.insert("template_capabilities", {
      template_id,
      body,
      position,
      created_at: now,
      updated_at: now,
      updated_by_fde_id: actor_fde_id,
    });
  },
});

export const updateCapability = mutation({
  args: {
    capability_id: v.id("template_capabilities"),
    body: v.string(),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, { capability_id, body, actor_fde_id }) => {
    await assertOperator(ctx);
    await ctx.db.patch(capability_id, {
      body,
      updated_at: nowIso(),
      updated_by_fde_id: actor_fde_id,
    });
  },
});

export const reorderCapability = mutation({
  args: {
    capability_id: v.id("template_capabilities"),
    new_position: v.number(),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, { capability_id, new_position, actor_fde_id }) => {
    await assertOperator(ctx);
    await ctx.db.patch(capability_id, {
      position: new_position,
      updated_at: nowIso(),
      updated_by_fde_id: actor_fde_id,
    });
  },
});

/**
 * Swap two capability positions atomically. Replaces the previous two-call
 * client-side dance which could leave the list with duplicate positions
 * or in a half-swapped state if a refresh / concurrent reorder landed in
 * the middle. Convex mutations are transactional, so this is safe.
 */
export const swapCapabilityPositions = mutation({
  args: {
    a_id: v.id("template_capabilities"),
    b_id: v.id("template_capabilities"),
    actor_fde_id: v.union(v.id("fdes"), v.null()),
  },
  handler: async (ctx, { a_id, b_id, actor_fde_id }) => {
    await assertOperator(ctx);
    if (a_id === b_id) return;
    const a = await ctx.db.get(a_id);
    const b = await ctx.db.get(b_id);
    if (!a || !b) throw new Error("capability not found");
    if (a.template_id !== b.template_id) {
      throw new Error("cannot swap capabilities across templates");
    }
    const now = nowIso();
    await ctx.db.patch(a_id, {
      position: b.position,
      updated_at: now,
      updated_by_fde_id: actor_fde_id,
    });
    await ctx.db.patch(b_id, {
      position: a.position,
      updated_at: now,
      updated_by_fde_id: actor_fde_id,
    });
  },
});

export const removeCapability = mutation({
  args: { capability_id: v.id("template_capabilities") },
  handler: async (ctx, { capability_id }) => {
    await assertOperator(ctx);
    await ctx.db.delete(capability_id);
  },
});

export const remove = mutation({
  args: { id: v.id("templates") },
  handler: async (ctx, { id }) => {
    await assertOperator(ctx);
    const caps = await ctx.db
      .query("template_capabilities")
      .withIndex("by_template_position", (q) => q.eq("template_id", id))
      .collect();
    for (const c of caps) await ctx.db.delete(c._id);
    await ctx.db.delete(id);
  },
});
