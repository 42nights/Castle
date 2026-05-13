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
