import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id, TableNames } from "../_generated/dataModel";

export function nowIso(): string {
  return new Date().toISOString();
}

export function slugify(input: string): string {
  // NFD-decompose accents (José → Jose) then strip combining marks.
  // Without this, accented Latin chars were silently dropped.
  // Non-Latin scripts (e.g. CJK) still fall through to the "x" fallback;
  // call sites are expected to validate that anyway.
  const normalized = input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  // Slice FIRST, then trim — slicing after trim could re-introduce a
  // trailing dash when the cut lands inside a dash run.
  const sliced = normalized.slice(0, 64).replace(/^-+|-+$/g, "");
  return sliced || "x";
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
  if (!base || base === "x") {
    // `slugify` returns "x" as a fallback for purely-non-alnum input.
    // Don't let that propagate as a stored slug.
    throw new Error("Refusing to generate a slug from empty/invalid input");
  }
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
