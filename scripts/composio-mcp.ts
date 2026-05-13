#!/usr/bin/env tsx
/**
 * Generates a Composio MCP server URL for an actor and prints the
 * `hermes mcp add` command to register it inside OrbStack.
 *
 * Usage:
 *   pnpm tsx scripts/composio-mcp.ts <actor-slug>
 *
 * The script:
 *   1. Lists the actor's ACTIVE Composio connections.
 *   2. Reuses an existing `castle-<actor>` MCP config if one's there;
 *      creates one with those toolkits otherwise.
 *   3. Generates a per-user MCP instance and prints its URL.
 *   4. Prints the exact `hermes mcp add composio --url …` line to run
 *      from the host.
 */
import { Composio } from "@composio/core";

const actor = process.argv[2] ?? process.env.CASTLE_ACTOR_SLUG;
if (!actor) {
  console.error("usage: tsx scripts/composio-mcp.ts <actor-slug>");
  process.exit(1);
}
if (!process.env.COMPOSIO_API_KEY) {
  console.error("COMPOSIO_API_KEY is required (see .env.local).");
  process.exit(1);
}

async function main() {
  const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY! });

  // 1. Live connections → toolkit slugs.
  const conns = await composio.connectedAccounts.list({
    userIds: [actor!],
    statuses: ["ACTIVE"],
    limit: 100,
  });
  const toolkits = Array.from(
    new Set(conns.items?.map((i) => i.toolkit.slug.toLowerCase()) ?? []),
  );
  if (toolkits.length === 0) {
    console.error(
      `No ACTIVE Composio connections for actor "${actor}". Connect one at /connections first.`,
    );
    process.exit(1);
  }
  console.error(`Toolkits for ${actor}: ${toolkits.join(", ")}`);

  // 2. Find or create the MCP config.
  const name = `castle-${actor}`;
  const list = await composio.mcp.list({
    name,
    page: 1,
    limit: 10,
    toolkits: [],
    authConfigs: [],
  });
  const items = (list as { items?: Array<{ name: string; id: string }> }).items ?? [];
  let serverId = items.find((s) => s.name === name)?.id;

  if (!serverId) {
    const created = await composio.mcp.create(name, {
      toolkits,
      // No allowedTools filter — Hermes gets every tool the toolkits offer.
      manuallyManageConnections: false,
    });
    serverId = created.id;
    console.error(`Created MCP config ${name} (${serverId}).`);
  } else {
    console.error(`Reusing MCP config ${name} (${serverId}).`);
  }

  // 3. Get a per-user instance — Composio bakes the userId into the URL,
  //    so this is what Hermes connects to.
  const instance = await composio.mcp.generate(actor!, serverId);

  console.error(`Allowed tools: ${instance.allowedTools.length}`);

  // 4. Print the URL on stdout (machine-readable) + the hermes command on stderr.
  console.error("\nFrom inside the VM:\n");
  console.error(
    `  orb -m hermes-dev bash -lc 'hermes mcp rm composio 2>/dev/null; printf "n\\ny\\n" | hermes mcp add composio --url ${instance.url}'\n`,
  );
  console.log(instance.url);
}

main().catch((err) => {
  console.error("composio-mcp fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
