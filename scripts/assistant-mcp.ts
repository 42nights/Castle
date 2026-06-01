#!/usr/bin/env tsx
/**
 * Personal Assistant MCP server.
 *
 * Minimal scaffold (A0/A3 demo scope): three tools proved real.
 * Full 32-tool surface is post-demo.
 *
 * Two transports:
 *   stdio (default): pnpm tsx scripts/assistant-mcp.ts
 *   HTTP  (--http [port], default 3002): pnpm tsx scripts/assistant-mcp.ts --http 3002
 */
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../convex/_generated/api.js";

// Lightweight .env.local loader
try {
  const env = readFileSync(".env.local", "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* .env.local absent is fine in CI / Railway */
}

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error(
    "assistant-mcp: NEXT_PUBLIC_CONVEX_URL is required (e.g. http://127.0.0.1:3210)",
  );
  process.exit(1);
}
const convex = new ConvexHttpClient(convexUrl);

// Admin auth — same pattern as castle-mcp
const convexDeployKey = process.env.CONVEX_DEPLOY_KEY;
if (convexDeployKey) {
  const serviceEmail =
    process.env.ASSISTANT_SERVICE_EMAIL ?? "assistant-mcp@42nights.dev";
  (
    convex as unknown as {
      setAdminAuth: (key: string, actingAs: { subject: string; issuer: string; email: string; name?: string }) => void;
    }
  ).setAdminAuth(convexDeployKey, {
    subject: "service:assistant-mcp",
    issuer: "https://assistant-mcp.internal",
    email: serviceEmail,
    name: "Personal Assistant MCP service",
  });
}

function text(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

function setupTools(server: McpServer) {

// ── lookup_castle_actor ───────────────────────────────────────────────────────
server.registerTool(
  "lookup_castle_actor",
  {
    description:
      "Map a Better Auth user_id to the Castle FDE slug (for Castle MCP calls). " +
      "Returns null if the user is not a registered FDE.",
    inputSchema: { user_id: z.string() },
  },
  async ({ user_id }) => {
    // Convention: FDE slugs are derived from the user's email local-part.
    // For the demo, we resolve known team members directly from the fdes table.
    const fdes = (await convex.query(api.fdes.list, {})) as Array<{
      slug: string;
      name: string;
    }>;

    // Attempt to match by user_id suffix (e.g. "user_ayaan" → slug "ayaan")
    // Real implementation would join against the Better Auth users table.
    const suffix = user_id.replace(/^user_/, "").toLowerCase();
    const match = fdes.find(
      (f) =>
        f.slug === suffix ||
        f.slug.startsWith(suffix) ||
        f.name.toLowerCase().replace(/\s+/g, "-") === suffix,
    );

    return text({ user_id, castle_actor_slug: match?.slug ?? null });
  },
);

// ── list_inbox ────────────────────────────────────────────────────────────────
server.registerTool(
  "list_inbox",
  {
    description:
      "List pending capture_inbox items for a user. Returns the most recent 20 pending items.",
    inputSchema: { user_id: z.string() },
  },
  async ({ user_id }) => {
    const items = (await convex.query(api.captureInbox.listPending, {
      user_id,
    })) as Array<{
      _id: string;
      body: string;
      source: string;
      status: string;
      created_at: string;
    }>;
    return text({ user_id, items });
  },
);

// ── capture_note ──────────────────────────────────────────────────────────────
server.registerTool(
  "capture_note",
  {
    description:
      "Add a note to the user's capture inbox. Use for quick capture — " +
      "the note will be processed by the capture_to_task workflow.",
    inputSchema: {
      user_id: z.string(),
      body: z.string().min(1).max(4000),
    },
  },
  async ({ user_id, body }) => {
    const id = await convex.mutation(api.captureInbox.insert, {
      user_id,
      body,
      source: "chat",
    });
    return text({ ok: true, id });
  },
);

} // end setupTools

function newServer(): McpServer {
  const s = new McpServer({ name: "assistant", version: "0.1.0" });
  setupTools(s);
  return s;
}

async function main() {
  const args = process.argv.slice(2);
  const httpFlag = args.indexOf("--http");
  if (httpFlag === -1) {
    await newServer().connect(new StdioServerTransport());
  } else {
    const port = Number(args[httpFlag + 1] ?? 3002);

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
      if (req.url === "/healthz" || req.url === "/health") {
        res
          .writeHead(200, { "content-type": "application/json" })
          .end(JSON.stringify({ ok: true, ts: new Date().toISOString() }));
        return;
      }
      if (!req.url?.startsWith("/mcp")) {
        res.writeHead(404).end();
        return;
      }

      try {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;
        const entry = sessionId ? sessions.get(sessionId) : undefined;

        let parsed: unknown = null;
        if (req.method === "POST") {
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const raw = Buffer.concat(chunks).toString();
          try {
            parsed = raw ? JSON.parse(raw) : null;
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
                    message: "Bad Request: No valid session ID. POST initialize first.",
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
        console.error("[assistant-mcp] request handler error:", err);
        if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
        res.end(err instanceof Error ? err.message : "internal error");
      }
    });

    http.listen(port, "0.0.0.0", () => {
      console.log(`assistant-mcp http://0.0.0.0:${port}/mcp`);
    });
  }
}

process.on("unhandledRejection", (reason) => {
  console.error("[assistant-mcp] unhandled rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[assistant-mcp] uncaught exception:", err);
});

main().catch((err) => {
  console.error("assistant-mcp fatal:", err);
  process.exit(1);
});
