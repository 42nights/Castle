import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { nowIso } from "./util";

type Kind =
  | "touched"
  | "phase_change"
  | "progress"
  | "reassign"
  | "note"
  | "health"
  | "create"
  | "delete";

/**
 * Stringify a payload defensively. `JSON.stringify` can:
 *   - return `undefined` for top-level functions/symbols/undefined
 *   - throw on circular references or BigInt
 * Neither should crash the parent mutation. Fall back to "{}" + log,
 * so the audit row still lands.
 */
function safeJsonString(payload: unknown): string {
  try {
    const out = JSON.stringify(payload ?? {});
    if (typeof out !== "string") return "{}";
    return out;
  } catch (err) {
    console.warn("[audit] payload serialization failed; storing {}:", err);
    return "{}";
  }
}

export async function logEngagementUpdate(
  ctx: MutationCtx,
  args: {
    engagement_id: Id<"engagements">;
    actor_fde_id: Id<"fdes">;
    kind: Kind;
    payload: unknown;
  },
) {
  await ctx.db.insert("engagement_updates", {
    engagement_id: args.engagement_id,
    actor_fde_id: args.actor_fde_id,
    kind: args.kind,
    payload_json: safeJsonString(args.payload),
    at: nowIso(),
  });
}
