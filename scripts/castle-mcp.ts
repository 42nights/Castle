#!/usr/bin/env tsx
/**
 * Castle MCP server.
 *
 * Wraps the same Convex mutations the in-app agent uses. Two transports:
 *
 *   stdio (default): for Claude Code / Codex / local MCP clients.
 *     pnpm tsx scripts/castle-mcp.ts
 *
 *   HTTP (`--http [port]`, default 3001): for Hermes running in OrbStack.
 *     The VM reaches the host at `host.orb.internal:3001`.
 *     pnpm tsx scripts/castle-mcp.ts --http 3001
 *
 *     Register from inside the VM:
 *       hermes mcp add castle --url http://host.orb.internal:3001/mcp
 */
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Composio } from "@composio/core";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../convex/_generated/api.js";

// Lightweight .env.local loader — no dependency needed, the MCP runs
// outside Next.js so process.env is bare.
try {
  const env = readFileSync(".env.local", "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* file missing is fine */
}

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!url) {
  console.error(
    "castle-mcp: NEXT_PUBLIC_CONVEX_URL is required (e.g. http://127.0.0.1:3210)",
  );
  process.exit(1);
}
const actorSlug = process.env.CASTLE_ACTOR_SLUG ?? null;
const convex = new ConvexHttpClient(url);

let actorIdCache: string | null | undefined;
async function actorId(): Promise<string | null> {
  if (actorIdCache !== undefined) return actorIdCache;
  if (!actorSlug) return (actorIdCache = null);
  const fde = (await convex.query(api.fdes.getBySlug, { slug: actorSlug })) as
    | { _id: string }
    | null;
  return (actorIdCache = fde?._id ?? null);
}

let composioCache: Composio | null = null;
function composio(): Composio | null {
  if (!process.env.COMPOSIO_API_KEY) return null;
  if (!composioCache)
    composioCache = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
  return composioCache;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const phases = ["discovery", "build", "deployed", "support"] as const;
const healths = ["green", "yellow", "red"] as const;
const statuses = ["active", "paused", "churned"] as const;
const fde_roles = ["Founder", "Senior FDE", "FDE", "Junior FDE"] as const;
const template_categories = ["GTM", "Ops", "Content", "BD", "Research"] as const;
const severities = ["critical", "high", "medium"] as const;

/**
 * Each transport binds to its own McpServer instance, so register all
 * tools through `setupTools(server)` rather than at module scope.
 */
function setupTools(server: McpServer) {
server.registerTool(
  "list_customers",
  {
    description: "List all customers (slug, name, status, health, MRR).",
    inputSchema: {},
  },
  async () => {
    const rows = (await convex.query(api.customers.list, {})) as Array<{
      slug: string;
      name: string;
      status: string;
      health: string;
      current_mrr: number;
    }>;
    return {
      content: [{ type: "text", text: JSON.stringify(rows.map(asCustomer)) }],
    };
  },
);

server.registerTool(
  "list_engagements",
  {
    description:
      "List all engagements (slug, phase, health, progress, weekly_hours).",
    inputSchema: {},
  },
  async () => {
    const rows = (await convex.query(api.engagements.list, {})) as Array<{
      slug: string;
      phase: string;
      health: string;
      progress_pct: number;
      weekly_hours: number;
    }>;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            rows.map((e) => ({
              slug: e.slug,
              phase: e.phase,
              health: e.health,
              progress: e.progress_pct,
              hours_per_week: e.weekly_hours,
            })),
          ),
        },
      ],
    };
  },
);

server.registerTool(
  "list_fdes",
  {
    description: "List FDEs (slug, name, role, capacity).",
    inputSchema: {},
  },
  async () => {
    const rows = (await convex.query(api.fdes.list, {})) as Array<{
      slug: string;
      name: string;
      role: string;
      capacity_hours_per_week: number;
    }>;
    return { content: [{ type: "text", text: JSON.stringify(rows) }] };
  },
);

server.registerTool(
  "list_templates",
  {
    description: "List templates (slug, name, category, github_repo).",
    inputSchema: {},
  },
  async () => {
    const rows = (await convex.query(api.templates.list, {})) as Array<{
      slug: string;
      name: string;
      category: string;
      github_repo?: string;
    }>;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            rows.map((t) => ({
              slug: t.slug,
              name: t.name,
              category: t.category,
              github_repo: t.github_repo ?? null,
            })),
          ),
        },
      ],
    };
  },
);

server.registerTool(
  "engagement_move_phase",
  {
    description:
      "Move an engagement to a new phase. 'support' pins progress to 100.",
    inputSchema: {
      engagement_slug: z.string(),
      phase: z.enum(phases),
    },
  },
  async ({ engagement_slug, phase }) => {
    const id = await actorId();
    if (!id) return text({ error: "CASTLE_ACTOR_SLUG not configured" });
    const eng = (await convex.query(api.engagements.getBySlug, {
      slug: engagement_slug,
    })) as { _id: string } | null;
    if (!eng) return text({ error: "engagement not found" });
    await convex.mutation(api.engagements.movePhase, {
      id: eng._id as never,
      phase,
      actor_fde_id: id as never,
    });
    return text({ ok: true, engagement: engagement_slug, phase });
  },
);

server.registerTool(
  "engagement_set_health",
  {
    description: "Set engagement health.",
    inputSchema: {
      engagement_slug: z.string(),
      health: z.enum(healths),
    },
  },
  async ({ engagement_slug, health }) => {
    const id = await actorId();
    if (!id) return text({ error: "CASTLE_ACTOR_SLUG not configured" });
    const eng = (await convex.query(api.engagements.getBySlug, {
      slug: engagement_slug,
    })) as { _id: string } | null;
    if (!eng) return text({ error: "engagement not found" });
    await convex.mutation(api.engagements.setHealth, {
      id: eng._id as never,
      health,
      actor_fde_id: id as never,
    });
    return text({ ok: true, engagement: engagement_slug, health });
  },
);

server.registerTool(
  "engagement_mark_touched",
  {
    description: "Mark engagement touched today.",
    inputSchema: { engagement_slug: z.string() },
  },
  async ({ engagement_slug }) => {
    const id = await actorId();
    if (!id) return text({ error: "CASTLE_ACTOR_SLUG not configured" });
    const eng = (await convex.query(api.engagements.getBySlug, {
      slug: engagement_slug,
    })) as { _id: string } | null;
    if (!eng) return text({ error: "engagement not found" });
    await convex.mutation(api.engagements.markTouched, {
      id: eng._id as never,
      actor_fde_id: id as never,
    });
    return text({ ok: true, engagement: engagement_slug });
  },
);

server.registerTool(
  "customer_set_mrr",
  {
    description: "Set customer MRR in dollars (integer).",
    inputSchema: {
      customer_slug: z.string(),
      mrr: z.number().int().min(0),
    },
  },
  async ({ customer_slug, mrr }) => {
    const id = await actorId();
    const cust = (await convex.query(api.customers.getBySlug, {
      slug: customer_slug,
    })) as { _id: string } | null;
    if (!cust) return text({ error: "customer not found" });
    await convex.mutation(api.customers.setMrr, {
      id: cust._id as never,
      current_mrr: mrr,
      actor_fde_id: id as never,
    });
    return text({ ok: true, customer: customer_slug, mrr });
  },
);

server.registerTool(
  "customer_set_health",
  {
    description: "Set customer health.",
    inputSchema: {
      customer_slug: z.string(),
      health: z.enum(healths),
    },
  },
  async ({ customer_slug, health }) => {
    const id = await actorId();
    const cust = (await convex.query(api.customers.getBySlug, {
      slug: customer_slug,
    })) as { _id: string } | null;
    if (!cust) return text({ error: "customer not found" });
    await convex.mutation(api.customers.setHealth, {
      id: cust._id as never,
      health,
      actor_fde_id: id as never,
    });
    return text({ ok: true, customer: customer_slug, health });
  },
);

server.registerTool(
  "customer_set_backed_by",
  {
    description:
      "Replace a customer's backer list (VCs, PE firms, accelerators). Full array — empty clears.",
    inputSchema: {
      customer_slug: z.string(),
      backed_by: z.array(z.string()),
    },
  },
  async ({ customer_slug, backed_by }) => {
    const id = await actorId();
    const cust = (await convex.query(api.customers.getBySlug, {
      slug: customer_slug,
    })) as { _id: string } | null;
    if (!cust) return text({ error: "customer not found" });
    await convex.mutation(api.customers.setBackedBy, {
      id: cust._id as never,
      backed_by,
      actor_fde_id: id as never,
    });
    return text({ ok: true, customer: customer_slug, backed_by });
  },
);

server.registerTool(
  "customer_set_status",
  {
    description: "Set customer status.",
    inputSchema: {
      customer_slug: z.string(),
      status: z.enum(statuses),
    },
  },
  async ({ customer_slug, status }) => {
    const id = await actorId();
    const cust = (await convex.query(api.customers.getBySlug, {
      slug: customer_slug,
    })) as { _id: string } | null;
    if (!cust) return text({ error: "customer not found" });
    await convex.mutation(api.customers.setStatus, {
      id: cust._id as never,
      status,
      actor_fde_id: id as never,
    });
    return text({ ok: true, customer: customer_slug, status });
  },
);

server.registerTool(
  "fde_set_capacity",
  {
    description: "Set FDE weekly capacity.",
    inputSchema: {
      fde_slug: z.string(),
      hours_per_week: z.number().min(0).max(80),
    },
  },
  async ({ fde_slug, hours_per_week }) => {
    const id = await actorId();
    if (!id) return text({ error: "CASTLE_ACTOR_SLUG not configured" });
    const fde = (await convex.query(api.fdes.getBySlug, {
      slug: fde_slug,
    })) as { _id: string } | null;
    if (!fde) return text({ error: "fde not found" });
    await convex.mutation(api.fdes.setCapacity, {
      id: fde._id as never,
      capacity_hours_per_week: hours_per_week,
      actor_fde_id: id as never,
    });
    return text({ ok: true, fde: fde_slug, capacity: hours_per_week });
  },
);

server.registerTool(
  "fde_log_hours",
  {
    description: "Add to FDE's actual-hours-this-week tally.",
    inputSchema: {
      fde_slug: z.string(),
      delta: z.number(),
    },
  },
  async ({ fde_slug, delta }) => {
    const id = await actorId();
    if (!id) return text({ error: "CASTLE_ACTOR_SLUG not configured" });
    const fde = (await convex.query(api.fdes.getBySlug, {
      slug: fde_slug,
    })) as { _id: string } | null;
    if (!fde) return text({ error: "fde not found" });
    await convex.mutation(api.fdes.logHours, {
      id: fde._id as never,
      delta,
      actor_fde_id: id as never,
    });
    return text({ ok: true, fde: fde_slug, delta });
  },
);

server.registerTool(
  "template_set_github_repo",
  {
    description:
      "Link a template to a GitHub repo. Accepts 'owner/repo' or a github.com URL.",
    inputSchema: {
      template_slug: z.string(),
      repo: z.string().nullable(),
    },
  },
  async ({ template_slug, repo }) => {
    const id = await actorId();
    const tpl = (await convex.query(api.templates.getBySlug, {
      slug: template_slug,
    })) as { _id: string } | null;
    if (!tpl) return text({ error: "template not found" });
    try {
      await convex.mutation(api.templates.setGithubRepo, {
        id: tpl._id as never,
        repo,
        actor_fde_id: id as never,
      });
      return text({ ok: true, template: template_slug, repo });
    } catch (e) {
      return text({ error: e instanceof Error ? e.message : "failed" });
    }
  },
);

server.registerTool(
  "composio_connect",
  {
    description:
      "Surface an OAuth 'Connect <service>' button to the operator inside the Castle chat. " +
      "USE THIS WHENEVER THE OPERATOR ASKS TO CONNECT, LINK, OR INTEGRATE AN EXTERNAL SERVICE " +
      "like GitHub, Slack, Linear, Gmail, Calendar, Notion, etc. Do NOT try to install CLIs, " +
      "create personal access tokens, or configure credential helpers yourself — Composio " +
      "handles auth via hosted OAuth.\n\n" +
      "ALWAYS CALL THIS TOOL FRESHLY. Composio's link sessions are ephemeral (short TTL). " +
      "If the operator asks to connect the same service again — even if you've called this " +
      "tool earlier in the conversation — CALL IT AGAIN. Each invocation generates a new, " +
      "valid OAuth link and replaces any expired one. Do not say 'I already gave you a link' " +
      "and refuse — links time out, regenerate them.",
    inputSchema: {
      toolkit: z
        .string()
        .describe(
          "Composio toolkit slug, lowercase. Common: github, slack, linear, gmail, googlecalendar, notion. " +
            "Search the catalog at /connections if unsure.",
        ),
    },
  },
  async ({ toolkit }) => {
    const slug = toolkit.toLowerCase().trim();
    const c = composio();
    if (!c) {
      return text({
        error: "COMPOSIO_API_KEY not configured in MCP environment",
      });
    }
    const userId = process.env.CASTLE_ACTOR_SLUG ?? "anon";
    try {
      // Find or create the auth config for this toolkit.
      const existing = await c.authConfigs.list({ toolkit: slug });
      let authConfigId = existing.items?.find(
        (a) => a.toolkit.slug.toLowerCase() === slug,
      )?.id;
      if (!authConfigId) {
        const created = await c.authConfigs.create(slug, {
          type: "use_composio_managed_auth",
          name: `Castle · ${slug}`,
        });
        authConfigId = created.id;
      }
      // Composio's pending (INITIATED / INITIATING) connections hold
      // the expired link session — clear them so link() issues a fresh
      // ephemeral nonce instead of re-returning the stale URL.
      try {
        const pending = await c.connectedAccounts.list({
          userIds: [userId],
          toolkitSlugs: [slug],
          statuses: [
            "INITIALIZING",
            "INITIATED",
            "EXPIRED",
            "FAILED",
            "INACTIVE",
          ],
          limit: 25,
        });
        for (const p of pending.items ?? []) {
          await c.connectedAccounts.delete(p.id).catch(() => {});
        }
      } catch (purgeErr) {
        // Non-fatal; link() may still issue a fresh URL.
        console.error("[composio_connect] purge failed:", purgeErr);
      }

      const conn = await c.connectedAccounts.link(userId, authConfigId, {
        callbackUrl: `${SITE_URL}/connections?return=1`,
      });
      if (!conn.redirectUrl) {
        return text({ error: "No redirect URL returned by Composio" });
      }
      // Surface in the chat as an inline CTA via the agent_actions table.
      await convex.mutation(api.agentActions.propose, {
        actor_slug: userId,
        kind: "composio_connect",
        toolkit: slug,
        url: conn.redirectUrl,
      });
      return text({
        ok: true,
        toolkit: slug,
        message: `A fresh Connect ${slug} button is now visible in the operator's chat. Previous expired link (if any) has been cleared. They need to click it to finish OAuth.`,
      });
    } catch (err) {
      return text({
        error: err instanceof Error ? err.message : "composio link failed",
      });
    }
  },
);

// ──────────────── Individual entity deletes ────────────────
// Composable: Hermes can `list_customers` then loop `customer_delete`
// to wipe everything. Each delete is scoped to a single row so the
// operator (or the agent) can stop / verify between iterations.

server.registerTool(
  "list_deployments",
  {
    description: "List all deployments (id, customer, agent name, hrs/wk).",
    inputSchema: {},
  },
  async () => {
    const rows = (await convex.query(api.deployments.list, {})) as Array<{
      _id: string;
      agent_name: string;
      hours_replaced_per_week: number;
    }>;
    return text(
      rows.map((d) => ({
        id: d._id,
        agent_name: d.agent_name,
        hours_per_week: d.hours_replaced_per_week,
      })),
    );
  },
);

server.registerTool(
  "list_pattern_extractions",
  {
    description: "List all pattern extractions (id, source, into).",
    inputSchema: {},
  },
  async () => {
    const rows = (await convex.query(api.patternExtractions.list, {})) as Array<{
      _id: string;
      source_engagement_summary: string;
    }>;
    return text(
      rows.map((p) => ({
        id: p._id,
        summary: p.source_engagement_summary?.slice(0, 80) ?? "",
      })),
    );
  },
);

server.registerTool(
  "customer_delete",
  {
    description:
      "Delete a single customer by slug. Caller's responsibility to delete or reassign " +
      "engagements / deployments that reference this customer first.",
    inputSchema: { customer_slug: z.string() },
  },
  async ({ customer_slug }) => {
    const cust = (await convex.query(api.customers.getBySlug, {
      slug: customer_slug,
    })) as { _id: string } | null;
    if (!cust) return text({ error: "customer not found" });
    try {
      await convex.mutation(api.customers.remove, { id: cust._id as never });
      return text({ ok: true, deleted: customer_slug });
    } catch (err) {
      return text({
        error: err instanceof Error ? err.message : "delete failed",
      });
    }
  },
);

server.registerTool(
  "engagement_delete",
  {
    description:
      "Delete a single engagement by slug. Cascades to assignments, deployments, " +
      "updates, notes — handled server-side.",
    inputSchema: { engagement_slug: z.string() },
  },
  async ({ engagement_slug }) => {
    const id = await actorId();
    if (!id) return text({ error: "CASTLE_ACTOR_SLUG not configured" });
    const eng = (await convex.query(api.engagements.getBySlug, {
      slug: engagement_slug,
    })) as { _id: string } | null;
    if (!eng) return text({ error: "engagement not found" });
    await convex.mutation(api.engagements.remove, {
      id: eng._id as never,
      actor_fde_id: id as never,
    });
    return text({ ok: true, deleted: engagement_slug });
  },
);

server.registerTool(
  "fde_delete",
  {
    description:
      "Delete a single FDE by slug. Caller's responsibility to reassign open " +
      "engagements first.",
    inputSchema: { fde_slug: z.string() },
  },
  async ({ fde_slug }) => {
    const fde = (await convex.query(api.fdes.getBySlug, {
      slug: fde_slug,
    })) as { _id: string } | null;
    if (!fde) return text({ error: "fde not found" });
    try {
      await convex.mutation(api.fdes.remove, { id: fde._id as never });
      return text({ ok: true, deleted: fde_slug });
    } catch (err) {
      return text({
        error: err instanceof Error ? err.message : "delete failed",
      });
    }
  },
);

server.registerTool(
  "template_delete",
  {
    description:
      "Delete a single template by slug. Cascades to template capabilities.",
    inputSchema: { template_slug: z.string() },
  },
  async ({ template_slug }) => {
    const tpl = (await convex.query(api.templates.getBySlug, {
      slug: template_slug,
    })) as { _id: string } | null;
    if (!tpl) return text({ error: "template not found" });
    await convex.mutation(api.templates.remove, { id: tpl._id as never });
    return text({ ok: true, deleted: template_slug });
  },
);

server.registerTool(
  "deployment_delete",
  {
    description: "Delete a single deployment by id (from list_deployments).",
    inputSchema: { deployment_id: z.string() },
  },
  async ({ deployment_id }) => {
    try {
      await convex.mutation(api.deployments.remove, {
        id: deployment_id as never,
      });
      return text({ ok: true, deleted: deployment_id });
    } catch (err) {
      return text({
        error: err instanceof Error ? err.message : "delete failed",
      });
    }
  },
);

server.registerTool(
  "pattern_extraction_delete",
  {
    description:
      "Delete a single pattern extraction by id (from list_pattern_extractions). " +
      "Cascades to reuse rows.",
    inputSchema: { extraction_id: z.string() },
  },
  async ({ extraction_id }) => {
    try {
      await convex.mutation(api.patternExtractions.remove, {
        id: extraction_id as never,
      });
      return text({ ok: true, deleted: extraction_id });
    } catch (err) {
      return text({
        error: err instanceof Error ? err.message : "delete failed",
      });
    }
  },
);

// ────────────────────────── CRUD parity: creates ──────────────────────────
//
// Every top-level entity gets a `create` wrapper that mirrors the Convex
// mutation, returning the freshly-minted slug so the agent can chain
// follow-up calls. Slug is generated server-side via `uniqueSlug` and may
// have a `-2`, `-3` suffix on collision — never reconstruct from `name`.

server.registerTool(
  "customer_create",
  {
    description:
      "Create a customer. Returns the minted slug for follow-up calls.",
    inputSchema: {
      name: z.string(),
      backed_by: z.array(z.string()),
      start_date: z.string().describe("ISO date, e.g. 2026-05-19"),
      status: z.enum(statuses),
      current_mrr: z.number().min(0),
      is_pe: z.boolean().default(false),
      health: z.enum(healths).default("green"),
    },
  },
  async ({ name, backed_by, start_date, status, current_mrr, is_pe, health }) => {
    const actor = await actorId();
    const res = (await convex.mutation(api.customers.create, {
      name,
      backed_by,
      start_date,
      status,
      current_mrr,
      is_pe,
      health,
      actor_fde_id: (actor ?? null) as never,
    })) as { id: string; slug: string };
    return text({ ok: true, slug: res.slug });
  },
);

server.registerTool(
  "customer_update",
  {
    description: "Patch name / backed_by / start_date / is_pe on a customer.",
    inputSchema: {
      customer_slug: z.string(),
      patch: z.object({
        name: z.string().optional(),
        backed_by: z.array(z.string()).optional(),
        start_date: z.string().optional(),
        is_pe: z.boolean().optional(),
      }),
    },
  },
  async ({ customer_slug, patch }) => {
    const actor = await actorId();
    const c = (await convex.query(api.customers.getBySlug, {
      slug: customer_slug,
    })) as { _id: string } | null;
    if (!c) return text({ error: "customer not found" });
    await convex.mutation(api.customers.update, {
      id: c._id as never,
      patch: patch as never,
      actor_fde_id: (actor ?? null) as never,
    });
    return text({ ok: true, customer: customer_slug });
  },
);

server.registerTool(
  "fde_create",
  {
    description: "Create an FDE. Returns the minted slug.",
    inputSchema: {
      name: z.string(),
      role: z.enum(fde_roles),
      is_founder: z.boolean(),
      start_date: z.string().describe("ISO date"),
      capacity_hours_per_week: z.number().min(0).max(80),
    },
  },
  async ({ name, role, is_founder, start_date, capacity_hours_per_week }) => {
    const actor = await actorId();
    const res = (await convex.mutation(api.fdes.create, {
      name,
      role,
      is_founder,
      start_date,
      capacity_hours_per_week,
      actor_fde_id: (actor ?? null) as never,
    })) as { id: string; slug: string };
    return text({ ok: true, slug: res.slug });
  },
);

server.registerTool(
  "fde_update",
  {
    description:
      "Patch name / role / is_founder / capacity / tags on an FDE. " +
      "For tag-only edits prefer fde_add_tag / fde_remove_tag / fde_set_tags.",
    inputSchema: {
      fde_slug: z.string(),
      patch: z.object({
        name: z.string().optional(),
        role: z.enum(fde_roles).optional(),
        is_founder: z.boolean().optional(),
        capacity_hours_per_week: z.number().min(0).max(80).optional(),
        tags: z.array(z.string()).optional(),
      }),
    },
  },
  async ({ fde_slug, patch }) => {
    const actor = await actorId();
    const f = (await convex.query(api.fdes.getBySlug, {
      slug: fde_slug,
    })) as { _id: string } | null;
    if (!f) return text({ error: "fde not found" });
    await convex.mutation(api.fdes.update, {
      id: f._id as never,
      patch: patch as never,
      actor_fde_id: (actor ?? null) as never,
    });
    return text({ ok: true, fde: fde_slug });
  },
);

// ─────────────── fde tags ───────────────

server.registerTool(
  "fde_set_tags",
  {
    description:
      "Replace an FDE's full tag list. Tags are trimmed + deduped server-side.",
    inputSchema: { fde_slug: z.string(), tags: z.array(z.string()) },
  },
  async ({ fde_slug, tags }) => {
    const actor = await actorId();
    const f = (await convex.query(api.fdes.getBySlug, {
      slug: fde_slug,
    })) as { _id: string } | null;
    if (!f) return text({ error: "fde not found" });
    await convex.mutation(api.fdes.setTags, {
      id: f._id as never,
      tags: tags as never,
      actor_fde_id: (actor ?? null) as never,
    });
    return text({ ok: true, fde: fde_slug, tags });
  },
);

server.registerTool(
  "fde_add_tag",
  {
    description:
      "Atomically add a tag to an FDE. No-op if the tag is already set.",
    inputSchema: { fde_slug: z.string(), tag: z.string() },
  },
  async ({ fde_slug, tag }) => {
    const actor = await actorId();
    const f = (await convex.query(api.fdes.getBySlug, {
      slug: fde_slug,
    })) as { _id: string } | null;
    if (!f) return text({ error: "fde not found" });
    await convex.mutation(api.fdes.addTag, {
      id: f._id as never,
      tag,
      actor_fde_id: (actor ?? null) as never,
    });
    return text({ ok: true, fde: fde_slug, added: tag });
  },
);

server.registerTool(
  "fde_remove_tag",
  {
    description:
      "Atomically remove a tag from an FDE. Case-insensitive match.",
    inputSchema: { fde_slug: z.string(), tag: z.string() },
  },
  async ({ fde_slug, tag }) => {
    const actor = await actorId();
    const f = (await convex.query(api.fdes.getBySlug, {
      slug: fde_slug,
    })) as { _id: string } | null;
    if (!f) return text({ error: "fde not found" });
    await convex.mutation(api.fdes.removeTag, {
      id: f._id as never,
      tag,
      actor_fde_id: (actor ?? null) as never,
    });
    return text({ ok: true, fde: fde_slug, removed: tag });
  },
);

server.registerTool(
  "list_fde_tags",
  {
    description:
      "List every distinct tag in use across all FDEs (alphabetical). " +
      "The autocomplete pool for the tag editor.",
    inputSchema: {},
  },
  async () => {
    const tags = (await convex.query(api.fdes.listTags, {})) as string[];
    return text({ tags });
  },
);

server.registerTool(
  "engagement_create",
  {
    description:
      "Create an engagement linking a customer to one or more FDEs. " +
      "Returns the minted engagement slug.",
    inputSchema: {
      customer_slug: z.string(),
      fde_slugs: z.array(z.string()).min(1),
      start_date: z.string().describe("ISO date"),
      expected_end_date: z.string().describe("ISO date"),
      phase: z.enum(phases).default("discovery"),
      progress_pct: z.number().min(0).max(100).default(0),
      weekly_hours: z.number().min(0).default(0),
      health: z.enum(healths).default("green"),
      notes: z.string().default(""),
    },
  },
  async ({
    customer_slug,
    fde_slugs,
    start_date,
    expected_end_date,
    phase,
    progress_pct,
    weekly_hours,
    health,
    notes,
  }) => {
    const actor = await actorId();
    const c = (await convex.query(api.customers.getBySlug, {
      slug: customer_slug,
    })) as { _id: string } | null;
    if (!c) return text({ error: `customer '${customer_slug}' not found` });
    const fde_ids: string[] = [];
    for (const slug of fde_slugs) {
      const f = (await convex.query(api.fdes.getBySlug, { slug })) as
        | { _id: string }
        | null;
      if (!f) return text({ error: `fde '${slug}' not found` });
      fde_ids.push(f._id);
    }
    const res = (await convex.mutation(api.engagements.create, {
      customer_id: c._id as never,
      fde_ids: fde_ids as never,
      start_date,
      expected_end_date,
      phase,
      progress_pct,
      weekly_hours,
      health,
      notes,
      actor_fde_id: (actor ?? null) as never,
    })) as { id: string; slug: string };
    return text({ ok: true, slug: res.slug });
  },
);

server.registerTool(
  "engagement_update",
  {
    description: "Patch weekly_hours or expected_end_date on an engagement.",
    inputSchema: {
      engagement_slug: z.string(),
      patch: z.object({
        weekly_hours: z.number().min(0).optional(),
        expected_end_date: z.string().optional(),
      }),
    },
  },
  async ({ engagement_slug, patch }) => {
    const actor = await actorId();
    if (!actor) return text({ error: "CASTLE_ACTOR_SLUG not configured" });
    const e = (await convex.query(api.engagements.getBySlug, {
      slug: engagement_slug,
    })) as { _id: string } | null;
    if (!e) return text({ error: "engagement not found" });
    await convex.mutation(api.engagements.update, {
      id: e._id as never,
      patch: patch as never,
      actor_fde_id: actor as never,
    });
    return text({ ok: true, engagement: engagement_slug });
  },
);

server.registerTool(
  "engagement_set_progress",
  {
    description:
      "Set an engagement's progress percent (0-100). " +
      "Support-phase engagements are pinned at 100 — move phase first.",
    inputSchema: {
      engagement_slug: z.string(),
      percent: z.number().min(0).max(100),
    },
  },
  async ({ engagement_slug, percent }) => {
    const actor = await actorId();
    if (!actor) return text({ error: "CASTLE_ACTOR_SLUG not configured" });
    const e = (await convex.query(api.engagements.getBySlug, {
      slug: engagement_slug,
    })) as { _id: string } | null;
    if (!e) return text({ error: "engagement not found" });
    try {
      await convex.mutation(api.engagements.setProgress, {
        id: e._id as never,
        pct: percent,
        actor_fde_id: actor as never,
      });
      return text({ ok: true, engagement: engagement_slug, progress: percent });
    } catch (err) {
      return text({
        error: err instanceof Error ? err.message : "setProgress failed",
      });
    }
  },
);

server.registerTool(
  "engagement_reassign",
  {
    description:
      "Replace the active assignment list for an engagement. Pass the FULL " +
      "list of FDE slugs that should be assigned — anyone not in the list " +
      "is removed.",
    inputSchema: {
      engagement_slug: z.string(),
      fde_slugs: z.array(z.string()),
    },
  },
  async ({ engagement_slug, fde_slugs }) => {
    const actor = await actorId();
    if (!actor) return text({ error: "CASTLE_ACTOR_SLUG not configured" });
    const e = (await convex.query(api.engagements.getBySlug, {
      slug: engagement_slug,
    })) as { _id: string } | null;
    if (!e) return text({ error: "engagement not found" });
    const fde_ids: string[] = [];
    for (const slug of fde_slugs) {
      const f = (await convex.query(api.fdes.getBySlug, { slug })) as
        | { _id: string }
        | null;
      if (!f) return text({ error: `fde '${slug}' not found` });
      fde_ids.push(f._id);
    }
    await convex.mutation(api.engagements.reassign, {
      id: e._id as never,
      fde_ids: fde_ids as never,
      actor_fde_id: actor as never,
    });
    return text({ ok: true, engagement: engagement_slug, fdes: fde_slugs });
  },
);

server.registerTool(
  "engagement_save_notes",
  {
    description:
      "Replace an engagement's current notes. Reads the current notes_version " +
      "to satisfy the optimistic-concurrency check — fails if someone else " +
      "saved notes between read and write (rare).",
    inputSchema: { engagement_slug: z.string(), body: z.string() },
  },
  async ({ engagement_slug, body }) => {
    const actor = await actorId();
    if (!actor) return text({ error: "CASTLE_ACTOR_SLUG not configured" });
    const e = (await convex.query(api.engagements.getBySlug, {
      slug: engagement_slug,
    })) as { _id: string; notes_version: number } | null;
    if (!e) return text({ error: "engagement not found" });
    try {
      await convex.mutation(api.engagements.saveNotes, {
        id: e._id as never,
        body,
        base_version: e.notes_version,
        client_id: `mcp-${randomUUID()}`,
        actor_fde_id: actor as never,
      });
      return text({ ok: true, engagement: engagement_slug });
    } catch (err) {
      return text({
        error: err instanceof Error ? err.message : "saveNotes failed",
      });
    }
  },
);

server.registerTool(
  "template_create",
  {
    description:
      "Create a template with initial capability list. Returns the minted slug.",
    inputSchema: {
      name: z.string(),
      category: z.enum(template_categories),
      capabilities: z.array(z.string()).default([]),
      origin_customer_slug: z.string(),
      authored_by_fde_slug: z.string(),
    },
  },
  async ({
    name,
    category,
    capabilities,
    origin_customer_slug,
    authored_by_fde_slug,
  }) => {
    const actor = await actorId();
    const c = (await convex.query(api.customers.getBySlug, {
      slug: origin_customer_slug,
    })) as { _id: string } | null;
    if (!c)
      return text({
        error: `origin_customer '${origin_customer_slug}' not found`,
      });
    const f = (await convex.query(api.fdes.getBySlug, {
      slug: authored_by_fde_slug,
    })) as { _id: string } | null;
    if (!f)
      return text({
        error: `authored_by_fde '${authored_by_fde_slug}' not found`,
      });
    const res = (await convex.mutation(api.templates.create, {
      name,
      category,
      capabilities,
      origin_customer_id: c._id as never,
      authored_by_fde_id: f._id as never,
      actor_fde_id: (actor ?? null) as never,
    })) as { id: string; slug: string };
    return text({ ok: true, slug: res.slug });
  },
);

server.registerTool(
  "template_update",
  {
    description: "Patch name / category on a template.",
    inputSchema: {
      template_slug: z.string(),
      patch: z.object({
        name: z.string().optional(),
        category: z.enum(template_categories).optional(),
      }),
    },
  },
  async ({ template_slug, patch }) => {
    const actor = await actorId();
    const t = (await convex.query(api.templates.getBySlug, {
      slug: template_slug,
    })) as { _id: string } | null;
    if (!t) return text({ error: "template not found" });
    await convex.mutation(api.templates.update, {
      id: t._id as never,
      patch: patch as never,
      actor_fde_id: (actor ?? null) as never,
    });
    return text({ ok: true, template: template_slug });
  },
);

server.registerTool(
  "template_set_live_url",
  {
    description:
      "Link a template to a live URL (deployment / demo). Pass null to clear. " +
      "Bare domains get https:// prepended; URL is validated.",
    inputSchema: {
      template_slug: z.string(),
      url: z.string().nullable(),
    },
  },
  async ({ template_slug, url }) => {
    const actor = await actorId();
    const t = (await convex.query(api.templates.getBySlug, {
      slug: template_slug,
    })) as { _id: string } | null;
    if (!t) return text({ error: "template not found" });
    try {
      await convex.mutation(api.templates.setLiveUrl, {
        id: t._id as never,
        url: url as never,
        actor_fde_id: (actor ?? null) as never,
      });
      return text({ ok: true, template: template_slug, url });
    } catch (err) {
      return text({
        error: err instanceof Error ? err.message : "setLiveUrl failed",
      });
    }
  },
);

// ─────────────── template capabilities ───────────────
//
// Rows have no slug — they're keyed by (template_id, position). Every
// capability wrapper resolves the template first, then guards against the
// (rare) case where the position index has duplicates — if so, refuse so
// we don't silently pick the wrong row. The UI's atomic swap helper keeps
// the index clean in normal use.

async function resolveTemplateCaps(
  template_slug: string,
): Promise<
  | { error: string }
  | {
      template: { _id: string };
      caps: Array<{ _id: string; position: number; body: string }>;
    }
> {
  const t = (await convex.query(api.templates.getBySlug, {
    slug: template_slug,
  })) as { _id: string } | null;
  if (!t) return { error: `template '${template_slug}' not found` };
  const caps = (await convex.query(api.templates.listCapabilities, {
    template_id: t._id as never,
  })) as Array<{ _id: string; position: number; body: string }>;
  const positions = new Set(caps.map((c) => c.position));
  if (positions.size !== caps.length) {
    return {
      error:
        `template '${template_slug}' has duplicate capability positions — ` +
        `repair via the dashboard before mutating via MCP`,
    };
  }
  return { template: t, caps };
}

server.registerTool(
  "template_add_capability",
  {
    description:
      "Append a capability to a template. Returns the assigned position.",
    inputSchema: { template_slug: z.string(), body: z.string() },
  },
  async ({ template_slug, body }) => {
    const actor = await actorId();
    const r = await resolveTemplateCaps(template_slug);
    if ("error" in r) return text({ error: r.error });
    await convex.mutation(api.templates.addCapability, {
      template_id: r.template._id as never,
      body,
      actor_fde_id: (actor ?? null) as never,
    });
    const nextPos = r.caps.reduce((m, c) => Math.max(m, c.position), 0) + 1;
    return text({ ok: true, template: template_slug, position: nextPos });
  },
);

server.registerTool(
  "template_update_capability",
  {
    description: "Replace a capability's body at the given position.",
    inputSchema: {
      template_slug: z.string(),
      position: z.number().int().min(1),
      body: z.string(),
    },
  },
  async ({ template_slug, position, body }) => {
    const actor = await actorId();
    const r = await resolveTemplateCaps(template_slug);
    if ("error" in r) return text({ error: r.error });
    const cap = r.caps.find((c) => c.position === position);
    if (!cap) return text({ error: `no capability at position ${position}` });
    await convex.mutation(api.templates.updateCapability, {
      capability_id: cap._id as never,
      body,
      actor_fde_id: (actor ?? null) as never,
    });
    return text({ ok: true, template: template_slug, position });
  },
);

server.registerTool(
  "template_swap_capabilities",
  {
    description:
      "Atomically swap two capabilities' positions. Use this for any reorder " +
      "— blind position-set is unsafe (can create duplicates).",
    inputSchema: {
      template_slug: z.string(),
      position_a: z.number().int().min(1),
      position_b: z.number().int().min(1),
    },
  },
  async ({ template_slug, position_a, position_b }) => {
    const actor = await actorId();
    const r = await resolveTemplateCaps(template_slug);
    if ("error" in r) return text({ error: r.error });
    const a = r.caps.find((c) => c.position === position_a);
    const b = r.caps.find((c) => c.position === position_b);
    if (!a) return text({ error: `no capability at position ${position_a}` });
    if (!b) return text({ error: `no capability at position ${position_b}` });
    await convex.mutation(api.templates.swapCapabilityPositions, {
      a_id: a._id as never,
      b_id: b._id as never,
      actor_fde_id: (actor ?? null) as never,
    });
    return text({ ok: true, template: template_slug, swapped: [position_a, position_b] });
  },
);

server.registerTool(
  "template_remove_capability",
  {
    description: "Delete a capability at the given position.",
    inputSchema: {
      template_slug: z.string(),
      position: z.number().int().min(1),
    },
  },
  async ({ template_slug, position }) => {
    const r = await resolveTemplateCaps(template_slug);
    if ("error" in r) return text({ error: r.error });
    const cap = r.caps.find((c) => c.position === position);
    if (!cap) return text({ error: `no capability at position ${position}` });
    await convex.mutation(api.templates.removeCapability, {
      capability_id: cap._id as never,
    });
    return text({ ok: true, template: template_slug, removed_position: position });
  },
);

server.registerTool(
  "deployment_create",
  {
    description:
      "Record a deployment (an agent shipped for a customer engagement). " +
      "Returns the new deployment id — deployments have no slug.",
    inputSchema: {
      customer_slug: z.string(),
      engagement_slug: z.string(),
      template_slug: z.string().nullable().default(null),
      agent_name: z.string(),
      deployed_at: z.string().describe("ISO date"),
      hours_replaced_per_week: z.number().min(0),
      customization_pct: z.number().min(0).max(100),
    },
  },
  async ({
    customer_slug,
    engagement_slug,
    template_slug,
    agent_name,
    deployed_at,
    hours_replaced_per_week,
    customization_pct,
  }) => {
    const c = (await convex.query(api.customers.getBySlug, {
      slug: customer_slug,
    })) as { _id: string } | null;
    if (!c) return text({ error: `customer '${customer_slug}' not found` });
    const e = (await convex.query(api.engagements.getBySlug, {
      slug: engagement_slug,
    })) as { _id: string } | null;
    if (!e) return text({ error: `engagement '${engagement_slug}' not found` });
    let template_id: string | null = null;
    if (template_slug) {
      const t = (await convex.query(api.templates.getBySlug, {
        slug: template_slug,
      })) as { _id: string } | null;
      if (!t) return text({ error: `template '${template_slug}' not found` });
      template_id = t._id;
    }
    const id = (await convex.mutation(api.deployments.create, {
      customer_id: c._id as never,
      engagement_id: e._id as never,
      template_id: template_id as never,
      agent_name,
      deployed_at,
      hours_replaced_per_week,
      customization_pct,
    })) as string;
    return text({ ok: true, id });
  },
);

server.registerTool(
  "deployment_update",
  {
    description:
      "Patch fields on a deployment. Pass `template_slug: null` to clear the " +
      "template link.",
    inputSchema: {
      deployment_id: z.string(),
      patch: z.object({
        agent_name: z.string().optional(),
        deployed_at: z.string().optional(),
        hours_replaced_per_week: z.number().min(0).optional(),
        customization_pct: z.number().min(0).max(100).optional(),
        template_slug: z.string().nullable().optional(),
      }),
    },
  },
  async ({ deployment_id, patch }) => {
    const { template_slug, ...rest } = patch;
    const resolved: Record<string, unknown> = { ...rest };
    if (template_slug !== undefined) {
      if (template_slug === null) {
        resolved.template_id = null;
      } else {
        const t = (await convex.query(api.templates.getBySlug, {
          slug: template_slug,
        })) as { _id: string } | null;
        if (!t) return text({ error: `template '${template_slug}' not found` });
        resolved.template_id = t._id;
      }
    }
    await convex.mutation(api.deployments.update, {
      id: deployment_id as never,
      patch: resolved as never,
    });
    return text({ ok: true, id: deployment_id });
  },
);

server.registerTool(
  "pattern_extraction_extract",
  {
    description:
      "Extract a pattern from a source engagement into a template — either " +
      "an existing template or a freshly-minted one. When minting new, the " +
      "response includes `template_slug` for chaining (e.g. set repo / live URL).",
    inputSchema: {
      source_engagement_slug: z.string(),
      source_engagement_summary: z.string(),
      target_template_slug: z.string().nullable().default(null),
      new_template: z
        .object({
          name: z.string(),
          category: z.enum(template_categories),
          capabilities: z.array(z.string()).default([]),
          authored_by_fde_slug: z.string(),
        })
        .nullable()
        .default(null),
      reused_customer_slugs: z.array(z.string()).default([]),
    },
  },
  async ({
    source_engagement_slug,
    source_engagement_summary,
    target_template_slug,
    new_template,
    reused_customer_slugs,
  }) => {
    const actor = await actorId();
    if (!actor) return text({ error: "CASTLE_ACTOR_SLUG not configured" });
    const e = (await convex.query(api.engagements.getBySlug, {
      slug: source_engagement_slug,
    })) as { _id: string } | null;
    if (!e)
      return text({
        error: `engagement '${source_engagement_slug}' not found`,
      });
    let target_template_id: string | null = null;
    if (target_template_slug) {
      const t = (await convex.query(api.templates.getBySlug, {
        slug: target_template_slug,
      })) as { _id: string } | null;
      if (!t)
        return text({
          error: `target_template '${target_template_slug}' not found`,
        });
      target_template_id = t._id;
    }
    let resolved_new_template:
      | {
          name: string;
          category: (typeof template_categories)[number];
          capabilities: string[];
          authored_by_fde_id: string;
        }
      | null = null;
    if (new_template) {
      const f = (await convex.query(api.fdes.getBySlug, {
        slug: new_template.authored_by_fde_slug,
      })) as { _id: string } | null;
      if (!f)
        return text({
          error: `authored_by_fde '${new_template.authored_by_fde_slug}' not found`,
        });
      resolved_new_template = {
        name: new_template.name,
        category: new_template.category,
        capabilities: new_template.capabilities,
        authored_by_fde_id: f._id,
      };
    }
    const reused_customer_ids: string[] = [];
    for (const slug of reused_customer_slugs) {
      const c = (await convex.query(api.customers.getBySlug, { slug })) as
        | { _id: string }
        | null;
      if (!c) return text({ error: `customer '${slug}' not found` });
      reused_customer_ids.push(c._id);
    }
    const res = (await convex.mutation(api.patternExtractions.extract, {
      source_engagement_id: e._id as never,
      source_engagement_summary,
      target_template_id: target_template_id as never,
      new_template: resolved_new_template as never,
      reused_customer_ids: reused_customer_ids as never,
      actor_fde_id: actor as never,
    })) as {
      extraction_id: string;
      template_id: string | null;
      template_slug: string | null;
    };
    return text({
      ok: true,
      extraction_id: res.extraction_id,
      template_slug: res.template_slug,
    });
  },
);

server.registerTool(
  "pattern_extraction_add_reused_customer",
  {
    description: "Add a customer to a pattern extraction's reuse list.",
    inputSchema: { extraction_id: z.string(), customer_slug: z.string() },
  },
  async ({ extraction_id, customer_slug }) => {
    const c = (await convex.query(api.customers.getBySlug, {
      slug: customer_slug,
    })) as { _id: string } | null;
    if (!c) return text({ error: `customer '${customer_slug}' not found` });
    await convex.mutation(api.patternExtractions.addReusedCustomer, {
      extraction_id: extraction_id as never,
      customer_id: c._id as never,
    });
    return text({ ok: true, extraction_id, customer: customer_slug });
  },
);

server.registerTool(
  "pattern_extraction_remove_reused_customer",
  {
    description: "Remove a customer from a pattern extraction's reuse list.",
    inputSchema: { extraction_id: z.string(), customer_slug: z.string() },
  },
  async ({ extraction_id, customer_slug }) => {
    const c = (await convex.query(api.customers.getBySlug, {
      slug: customer_slug,
    })) as { _id: string } | null;
    if (!c) return text({ error: `customer '${customer_slug}' not found` });
    await convex.mutation(api.patternExtractions.removeReusedCustomer, {
      extraction_id: extraction_id as never,
      customer_id: c._id as never,
    });
    return text({ ok: true, extraction_id, customer: customer_slug });
  },
);

// ─────────────── founder hours ───────────────

server.registerTool(
  "founder_hours_upsert_month",
  {
    description:
      "Set founder-hours-this-month + new-ARR for a month (YYYY-MM). Creates " +
      "the row if missing, patches in place if present.",
    inputSchema: {
      month: z.string().regex(/^\d{4}-\d{2}$/, "expected YYYY-MM"),
      founder_hours_total: z.number().min(0),
      new_arr_dollars: z.number(),
    },
  },
  async ({ month, founder_hours_total, new_arr_dollars }) => {
    await convex.mutation(api.founderHours.upsertMonth, {
      month,
      founder_hours_total,
      new_arr_dollars,
    });
    return text({ ok: true, month });
  },
);

server.registerTool(
  "founder_hours_delete",
  {
    description: "Delete the founder-hours row for a month (YYYY-MM).",
    inputSchema: {
      month: z.string().regex(/^\d{4}-\d{2}$/, "expected YYYY-MM"),
    },
  },
  async ({ month }) => {
    const rows = (await convex.query(api.founderHours.list, {})) as Array<{
      _id: string;
      month: string;
    }>;
    const row = rows.find((r) => r.month === month);
    if (!row) return text({ error: `no founder_hours row for ${month}` });
    await convex.mutation(api.founderHours.remove, { id: row._id as never });
    return text({ ok: true, month });
  },
);

// ─────────────── attention queue ───────────────
//
// `item_key` is the canonical identifier for attention items. Auto-derived
// items use stable keys built from the underlying entity (e.g.
// "engagement-stale:<id>"); manual items use the literal "manual:<id>"
// shape. `attention_resolve` routes to `resolveManualItem` for the latter
// since the generic `resolve` only writes a dismissal row that doesn't hide
// manual entries.

server.registerTool(
  "list_attention",
  {
    description:
      "List every open attention item — auto-derived (stale engagements, " +
      "red customers, etc.) plus manual_attention_items. Each row carries " +
      "an `item_key` that snooze/resolve/clear_snooze take as input.",
    inputSchema: {},
  },
  async () => {
    const items = await convex.query(api.attention.list, {
      nowBucket: Math.floor(Date.now() / 60_000),
    });
    return text(items);
  },
);

server.registerTool(
  "attention_snooze",
  {
    description:
      "Snooze an attention item until `until_iso` (ISO datetime). The item " +
      "reappears once the snooze expires.",
    inputSchema: {
      item_key: z.string(),
      until_iso: z.string().describe("ISO datetime, e.g. 2026-05-26T00:00:00Z"),
      reason: z.string().default(""),
    },
  },
  async ({ item_key, until_iso, reason }) => {
    const actor = await actorId();
    if (!actor) return text({ error: "CASTLE_ACTOR_SLUG not configured" });
    await convex.mutation(api.attention.snooze, {
      item_key,
      until: until_iso,
      reason,
      actor_fde_id: actor as never,
    });
    return text({ ok: true, item_key, until: until_iso });
  },
);

server.registerTool(
  "attention_clear_snooze",
  {
    description: "Remove the snooze on an attention item so it reappears.",
    inputSchema: { item_key: z.string() },
  },
  async ({ item_key }) => {
    await convex.mutation(api.attention.clearSnooze, { item_key });
    return text({ ok: true, item_key });
  },
);

server.registerTool(
  "attention_resolve",
  {
    description:
      "Mark an attention item resolved. For manual items (item_key starts " +
      "with `manual:`) this hides the item permanently via " +
      "resolveManualItem; for auto-derived items it dismisses for a year.",
    inputSchema: { item_key: z.string() },
  },
  async ({ item_key }) => {
    const actor = await actorId();
    if (!actor) return text({ error: "CASTLE_ACTOR_SLUG not configured" });
    if (item_key.startsWith("manual:")) {
      const id = item_key.slice("manual:".length);
      try {
        await convex.mutation(api.attention.resolveManualItem, {
          id: id as never,
          actor_fde_id: actor as never,
        });
        return text({ ok: true, item_key, kind: "manual" });
      } catch (err) {
        return text({
          error: err instanceof Error ? err.message : "resolveManual failed",
        });
      }
    }
    await convex.mutation(api.attention.resolve, {
      item_key,
      actor_fde_id: actor as never,
    });
    return text({ ok: true, item_key, kind: "auto" });
  },
);

server.registerTool(
  "attention_create_manual",
  {
    description:
      "Create a manual attention item — a free-form todo that sits in the " +
      "attention queue until resolved.",
    inputSchema: {
      title: z.string(),
      subtitle: z.string().default(""),
      severity: z.enum(severities).default("medium"),
      owner_fde_slug: z.string().nullable().default(null),
      customer_slug: z.string().nullable().default(null),
      engagement_slug: z.string().nullable().default(null),
      href: z.string().default(""),
    },
  },
  async ({
    title,
    subtitle,
    severity: sev,
    owner_fde_slug,
    customer_slug,
    engagement_slug,
    href,
  }) => {
    const actor = await actorId();
    let owner_fde_id: string | null = null;
    if (owner_fde_slug) {
      const f = (await convex.query(api.fdes.getBySlug, {
        slug: owner_fde_slug,
      })) as { _id: string } | null;
      if (!f)
        return text({ error: `owner_fde '${owner_fde_slug}' not found` });
      owner_fde_id = f._id;
    }
    let related_customer_id: string | null = null;
    if (customer_slug) {
      const c = (await convex.query(api.customers.getBySlug, {
        slug: customer_slug,
      })) as { _id: string } | null;
      if (!c) return text({ error: `customer '${customer_slug}' not found` });
      related_customer_id = c._id;
    }
    let related_engagement_id: string | null = null;
    if (engagement_slug) {
      const e = (await convex.query(api.engagements.getBySlug, {
        slug: engagement_slug,
      })) as { _id: string } | null;
      if (!e)
        return text({ error: `engagement '${engagement_slug}' not found` });
      related_engagement_id = e._id;
    }
    const id = (await convex.mutation(api.attention.createManualItem, {
      title,
      subtitle,
      severity: sev,
      owner_fde_id: owner_fde_id as never,
      related_customer_id: related_customer_id as never,
      related_engagement_id: related_engagement_id as never,
      href,
      actor_fde_id: (actor ?? null) as never,
    })) as string;
    return text({ ok: true, id, item_key: `manual:${id}` });
  },
);

function text(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

function asCustomer(c: {
  slug: string;
  name: string;
  status: string;
  health: string;
  current_mrr: number;
}) {
  return {
    slug: c.slug,
    name: c.name,
    status: c.status,
    health: c.health,
    mrr: c.current_mrr,
  };
}

} // end setupTools

function newServer(): McpServer {
  const s = new McpServer({ name: "castle", version: "0.1.0" });
  setupTools(s);
  return s;
}

// ─────────────────────────── transport selection ───────────────────────────

async function main() {
const args = process.argv.slice(2);
const httpFlag = args.indexOf("--http");
if (httpFlag === -1) {
  await newServer().connect(new StdioServerTransport());
} else {
  const port = Number(args[httpFlag + 1] ?? 3001);

  // Stateful transports keyed by mcp-session-id. Each session gets its own
  // McpServer instance because the SDK forbids reusing one across transports.
  const sessions = new Map<
    string,
    { server: McpServer; transport: StreamableHTTPServerTransport }
  >();

  const http = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "content-type, mcp-session-id, last-event-id",
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, DELETE, OPTIONS",
    );
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }
    if (!req.url?.startsWith("/mcp")) {
      res.writeHead(404).end();
      return;
    }

    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let entry = sessionId ? sessions.get(sessionId) : undefined;

      let parsed: unknown = null;
      if (req.method === "POST") {
        let body = "";
        for await (const chunk of req) body += chunk;
        try {
          parsed = body ? JSON.parse(body) : null;
        } catch {
          res
            .writeHead(400, { "content-type": "application/json" })
            .end(
              JSON.stringify({
                jsonrpc: "2.0",
                error: { code: -32700, message: "parse error" },
                id: null,
              }),
            );
          return;
        }
      }

      if (!entry) {
        const isInit =
          parsed !== null &&
          typeof parsed === "object" &&
          (parsed as { method?: string }).method === "initialize";
        if (req.method !== "POST" || !isInit) {
          res
            .writeHead(400, { "content-type": "application/json" })
            .end(
              JSON.stringify({
                jsonrpc: "2.0",
                error: {
                  code: -32000,
                  message:
                    "Bad Request: No valid session ID. POST initialize first.",
                },
                id: null,
              }),
            );
          return;
        }
        const server = newServer();
        const transport: StreamableHTTPServerTransport =
          new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (id) => {
              sessions.set(id, { server, transport });
            },
          });
        transport.onclose = () => {
          if (transport.sessionId) sessions.delete(transport.sessionId);
        };
        await server.connect(transport);
        await transport.handleRequest(req, res, parsed);
        return;
      }

      await entry.transport.handleRequest(req, res, parsed);
    } catch (err) {
      console.error("[mcp] request handler error:", err);
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
      res.end(err instanceof Error ? err.message : "internal error");
    }
  });

  http.listen(port, "0.0.0.0", () => {
    console.log(`castle-mcp http://0.0.0.0:${port}/mcp`);
  });
}
}


main().catch((err) => {
  console.error("castle-mcp fatal:", err);
  process.exit(1);
});
