/**
 * runMorningBrief — the demo beat-10 action.
 *
 * Manually triggered (no cron for now). Runs the morning-brief workflow,
 * writes workflow_runs + daily_digests rows, returns the digest markdown.
 */
import { v } from "convex/values";
import { action } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { morningBriefWorkflow } from "../src/workflows/builtins/morning-brief";
import { runWorkflow } from "../src/workflows/run";

export const runMorningBrief = action({
  args: { user_id: v.string() },
  handler: async (
    ctx,
    { user_id },
  ): Promise<{
    markdown: string;
    digest_id: Id<"daily_digests">;
    run_id: Id<"workflow_runs">;
  }> => {
    // Ensure prefs row exists
    await ctx.runMutation(api.userPreferences.getOrCreate, { user_id });

    // Create a running workflow_runs row
    const runId = (await ctx.runMutation(api.workflowRuns.start, {
      user_id,
      workflow_slug: morningBriefWorkflow.slug,
      trigger: "manual",
    })) as Id<"workflow_runs">;

    const today = new Date().toISOString().slice(0, 10);
    let markdown = "";
    let steps: unknown[] = [];

    try {
      const result = await runWorkflow(morningBriefWorkflow, {
        user_id,
        user_name: "Ayaan",
        castle_actor: "ayaan",
        today,
      });

      markdown = result.markdown;
      steps = result.steps;

      // Mark run succeeded
      await ctx.runMutation(api.workflowRuns.finish, {
        id: runId,
        status: "succeeded",
        steps_json: JSON.stringify(steps),
      });
    } catch (err) {
      const errMsg = String(err);
      await ctx.runMutation(api.workflowRuns.finish, {
        id: runId,
        status: "failed",
        steps_json: JSON.stringify(steps),
        error: errMsg,
      });
      throw err;
    }

    // Upsert the digest row (idempotent on user + date)
    const digestId = (await ctx.runMutation(api.dailyDigests.upsertToday, {
      user_id,
      date: today,
      markdown,
      workflow_run_id: runId,
    })) as Id<"daily_digests">;

    return { markdown, digest_id: digestId, run_id: runId };
  },
});

/** Seed built-in workflows into the assistant_workflows table. */
export const seedWorkflows = action({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(internal.assistantWorkflows.seedBuiltins, {});
    return { ok: true };
  },
});
