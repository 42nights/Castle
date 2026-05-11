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
cp .env.local.example .env.local

# one-time: provision a Convex dev deployment (interactive)
pnpm convex:dev         # prints NEXT_PUBLIC_CONVEX_URL — paste into .env.local

# one-time: import data/*.json fixture into Convex
pnpm seed:convex

# everyday:
pnpm dev:all            # next on :3000 + convex dev (live codegen + sync)
```

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
- `convex/_generated/` — committed shim that real `convex codegen` will overwrite once `pnpm convex:dev` runs.
- Mutations always include `actor_fde_id` derived from a localStorage-backed `useActorSlug()` — no auth in v1, single internal user.

## Deploy

Vercel deploy. Set `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOYMENT` in the Vercel env. Convex production deployment via `pnpm convex:deploy`.

## Honest framing

The point is to reflect reality, not the deck. Few templates today, `hoursPerArrK` may be flat or worse before it gets better. The *trajectory* and the *target trendline* on the founder leverage chart are the persuasive piece. Don't inflate.
