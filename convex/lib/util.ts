import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id, TableNames } from "../_generated/dataModel";

export function nowIso(): string {
  return new Date().toISOString();
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "x";
}

/**
 * Look up a slug-indexed row; if taken, append `-2`, `-3`, … until unique.
 * Must be called inside a mutation transaction; the uniqueness window
 * extends only to the same transaction. For our single-user app that's fine.
 */
export async function uniqueSlug<T extends TableNames>(
  ctx: MutationCtx,
  table: T,
  base: string,
): Promise<string> {
  let candidate = base;
  let i = 2;
  while (true) {
    const existing = await ctx.db
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .query(table as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .withIndex("by_slug" as any, (q: any) => q.eq("slug", candidate))
      .first();
    if (!existing) return candidate;
    candidate = `${base}-${i}`;
    i += 1;
  }
}

export async function requireFde(
  ctx: QueryCtx | MutationCtx,
  fde_id: Id<"fdes">,
) {
  const fde = await ctx.db.get(fde_id);
  if (!fde) throw new Error(`fde ${fde_id} not found`);
  return fde;
}
