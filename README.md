# Castle · by 42nights Inc.

The operating console 42nights runs on — engagements, FDE workload, agent templates, pattern extraction, founder leverage. Same surface investors see when they ask how we productize a services business.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, Tailwind v4
- shadcn/ui (sonner, table primitives), Recharts 3, TanStack table
- **Convex** for the backend — reactive queries, mutations, ID & slug schema
- Light mode design system (Fraunces + Inter + JetBrains Mono); source of truth in the Paper file

## Start

```bash
nvm use                 # node 22
pnpm install

# one-time: provision a local Convex deployment (no cloud login needed)
npx convex dev --once --configure new --dev-deployment local --project castle
#  writes .env.local with CONVEX_DEPLOYMENT + NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210
#  generates convex/_generated/ to match your schema

# one-time: import data/*.json fixture into Convex
pnpm seed:convex

# everyday:
pnpm dev:all            # next on :3000 + convex dev (live codegen + sync)
```

Convex `--dev-deployment local` runs the backend on `127.0.0.1:3210` — no team, project, or cloud login required. Switch to `--dev-deployment cloud` later for a hosted deployment.

Open `http://localhost:3000`. Pick your FDE actor in the top right ("you are…") — every mutation logs to that actor's audit row.

## Read-only fallback

If `NEXT_PUBLIC_CONVEX_URL` is missing, Castle still boots — it reads `data/*.json` directly and disables every mutation with a toast. That makes the v0 experience available even before Convex is set up.

## Stack diagram

```
                  ┌──────────────────────────┐
   Browser ─────► │  Next 16 App Router      │
                  │  - app/page.tsx (server) │
                  │  - section islands (RSC  │
                  │    + client where state) │
                  └──────────┬───────────────┘
                             │ preloadQuery + usePreloadedQuery
                             ▼
                  ┌──────────────────────────┐
                  │   Convex                 │
                  │  - schema.ts (12 tables) │
                  │  - dashboard.overview    │
                  │  - per-table CRUD        │
                  │  - attention.list (now-  │
                  │    bucketed, server-side │
                  │    snooze filter)        │
                  │  - engagement audit log  │
                  └──────────────────────────┘
```

## Data model (high level)

| Table | Why |
| --- | --- |
| `fdes` | Engineers on the bench. `capacity_hours_per_week` drives the workload board. |
| `customers` | Paying companies. `health` + `status` feed the attention queue. |
| `engagements` | The operational entity. `last_update_at` powers the stale flag. |
| `engagement_assignments` | Junction: which FDE is on which engagement. Avoids array re-writes on every reassign. |
| `deployments` | Concrete agents shipped to a customer, optionally based on a template. |
| `templates` + `template_capabilities` | Reusable agent patterns. Capabilities are ordered rows so drag-reorder is safe. |
| `pattern_extractions` + `pattern_extraction_reuses` | "Customer X needed Y → built as Template T → reused at N more customers." |
| `founder_hours` | Monthly founder hours vs new ARR. The investor signal chart. |
| `engagement_updates` | Append-only audit log of every state change. |
| `engagement_notes` | Append-only journal w/ `notes_version` optimistic concurrency for safe multi-tab edits. |
| `attention_dismissals` | Snoozes for derived attention rows. |
| `manual_attention_items` | User-added reminders surfaced in the operator queue. |

## What you can do

- **Phase columns** (homepage) — change phase, set progress, set health, mark touched, all inline on the card. No drag (status changes via dropdown per spec).
- **Attention queue** — Touched today, Snooze 24h/7d, Resolve per row. Manual reminder via `+` in the cmd-K palette.
- **FDE workload board** — capacity inline edit, log hours via +/-. Util bar recolors over capacity.
- **Customers table** — health, status, MRR inline. Click a row to open detail.
- **Engagement detail** — phase, progress, health, weekly hours, notes. Notes autosave with optimistic concurrency; stale base versions are rejected, not silently overwritten.
- **Founder hours chart** — "+ Log this month" upserts via `founderHours.upsertMonth`.
- **Extractions** — extract pattern wizard: pick source engagement, pick existing or new template, summary auto-fills from engagement notes, chip-toggle reused customers.
- **⌘K** anywhere — quick actions + navigation.

## Architecture / boundaries

- `app/page.tsx` — server component. Env-routes between Convex (`preloadQuery → OverviewIsland`) and JSON fallback (`loadAll → OverviewSections`).
- Section components are server by default; only the interactive ones (`AttentionListLive`, controls, dialogs) are `"use client"`.
- `lib/adapters.ts` — `ConvexOverview → AdaptedOverview` so the same `lib/derive.ts` pure helpers run over either Convex docs or JSON fixtures.
- `convex/_generated/` — generated by `convex dev` on every schema/function change. Committed so a fresh clone type-checks.
- Mutations always include `actor_fde_id` derived from a localStorage-backed `useActorSlug()` — no auth in v1, single internal user.

## Agent surface (Castle MCP)

Hermes — the AI agent powering the chat at `/` — talks to Castle through an MCP server defined in `scripts/castle-mcp.ts`. Two transports: stdio for local Claude Code / Codex use, and Streamable HTTP for Hermes (running on Railway, reachable at `castle-mcp.railway.internal:3001/mcp`).

Every operator-meaningful mutation is wrapped. Creates return the freshly-minted slug so the agent can chain follow-ups:

- `customer_create` / `customer_update` (+ existing health/status/MRR/backed-by setters)
- `fde_create` / `fde_update` (+ `set_capacity`, `log_hours`)
- `engagement_create` / `engagement_update` / `set_progress` / `reassign` / `save_notes` (+ `move_phase`, `set_health`, `mark_touched`)
- `template_create` / `template_update` / `set_github_repo` / `set_live_url` + capability ops (add / update / swap / remove)
- `deployment_create` / `deployment_update`
- `pattern_extraction_extract` (returns the new template slug when one is minted) + add/remove reused customers
- `founder_hours_upsert_month` / `founder_hours_delete`
- `list_attention` + `attention_snooze` / `clear_snooze` / `resolve` (auto-routes `manual:*` keys) / `create_manual`
- Plus the `list_*` reads, the `*_delete` row killers, and `composio_connect` for mint-a-toolkit-link.

Two conventions worth remembering when extending:

- **Public surface uses slugs, never Convex `_id`s.** Wrappers resolve `<entity>_slug` → `_id` via `getBySlug` before calling the mutation. Deployments are the exception (no slug); they return / accept `_id`.
- **Capability reorder is `swap_capabilities` only.** Raw position-patch can produce duplicate positions; the swap mutation is the only atomic reorder primitive. The wrappers also refuse to operate if the position index has duplicates rather than picking a row at random.

The MCP runs as its own Railway service alongside Hermes. `CASTLE_ACTOR_SLUG` env pins which FDE every mutation's audit row points at (single-tenant Phase A). Auth-derived per-user actor threading is Phase B work.

## Deploy

Vercel deploy. Set `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOYMENT` in the Vercel env. Convex production deployment via `pnpm convex:deploy`.

## Honest framing

The point is to reflect reality, not the deck. Few templates today, `hoursPerArrK` may be flat or worse before it gets better. The *trajectory* and the *target trendline* on the founder leverage chart are the persuasive piece. Don't inflate.
