#!/usr/bin/env node
// Reads data/*.json and calls the internal Convex seed mutation.
// Idempotent — Convex will skip if fdes already populated.
//
// Usage:  pnpm seed:convex
//   - reads NEXT_PUBLIC_CONVEX_URL from .env.local (or env)
//   - uses CONVEX_DEPLOY_KEY for auth if present (CI); otherwise relies on the
//     dev deployment URL being public-readable
//
// For internal mutations the safest path is `npx convex run`; we shell out
// to it so we don't have to surface a server-side admin key here.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = join(root, "data");
const read = (f) => JSON.parse(readFileSync(join(data, f), "utf8"));

const payload = {
  fdes: read("fdes.json"),
  customers: read("customers.json"),
  engagements: read("engagements.json"),
  templates: read("templates.json"),
  deployments: read("deployments.json"),
  extractions: read("pattern_extractions.json"),
  founderHours: read("founder_hours.json"),
};

const args = { payloadJson: JSON.stringify(payload) };

const result = spawnSync(
  "npx",
  ["convex", "run", "seed:importPayload", JSON.stringify(args)],
  { cwd: root, stdio: "inherit" },
);
process.exit(result.status ?? 0);
