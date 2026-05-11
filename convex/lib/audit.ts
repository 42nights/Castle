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
    payload_json: JSON.stringify(args.payload ?? {}),
    at: nowIso(),
  });
}
