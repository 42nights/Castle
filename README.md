# 42nights productization dashboard

Single-page internal dashboard tracking the FDE → productized-SaaS arc. Built for the a16z Speedrun reapplication.

## What it shows

- **Header stats**: active customers, contracted ARR, template count + maturity mix, hours/week of human work replaced
- **Revenue quality**: largest-customer concentration, top-3 share, template-based ARR %, churned ARR
- **Founder leverage**: founder-hours per $ of new ARR, raw + 3-month rolling, with a target trendline + honest status label
- **Agent template library**: cards with maturity badges, version, derived deployment counts; click to expand into the deployment list
- **Pattern extraction loop**: bespoke build → extract → reuse, with reuse counts derived from `deployments.json` (single source of truth)
- **Per-customer matrix**: contracted ARR vs current MRR, % template-based, hours replaced, churned rows shown for honesty
- **Internal dev tooling**: Warp sessions, Superset work trees, agent pipeline, Caveman Mode token savings

## Stack

- Next.js 16, React 19, TypeScript strict, Tailwind v4
- shadcn/ui (Card, Badge, Table, Collapsible, Chart), Recharts 3
- JSON files in `/data/` — no DB, no auth, single-user

## Run

```bash
nvm use         # node 22
pnpm install
pnpm dev        # http://localhost:3000
```

## Build / deploy

```bash
pnpm build
pnpm start
```

Vercel: `git push` to a repo linked to a Vercel project. Defaults are correct (Next.js 16, no env vars).

## Data

Seed JSON lives in `/data/`. See `/data/README.md` for schema notes and the "reuse is derived, not stored" gotcha. Edit any file, refresh the page, see the change.

To repopulate with real audit data:

1. Snapshot current files (commit them).
2. Run an internal audit (billing, deployments ledger, founder time-tracking).
3. Overwrite files in `/data/`.
4. Refresh.

## Architecture

```
app/
  layout.tsx        SERVER — dark-mode + fonts
  page.tsx          SERVER — loads data via lib/data, derives via lib/derive, passes
                    serializable props to each section
  globals.css       Tailwind + .num monospace utility + dark theme tokens

components/
  sections/
    HeaderStats.tsx        SERVER
    RevenueQuality.tsx     SERVER
    FounderHoursChart.tsx  CLIENT (Recharts)
    TemplateLibrary.tsx    CLIENT (Collapsible)
    PatternTimeline.tsx    SERVER
    CustomerMatrix.tsx     SERVER
    DevToolingStatus.tsx   SERVER
  ui/                       shadcn primitives

lib/
  data.ts           server-only — JSON loaders (import "server-only")
  derive.ts         pure — all metric computations live here
  format.ts         pure — USD, %, hours, months
  types.ts          pure — shared types, safe both sides
  utils.ts          shadcn-installed cn() helper
```

**Boundary invariant:** client components import types from `lib/types`, never from `lib/data`. The server-only barrier in `lib/data.ts` enforces this at runtime; the convention keeps it grep-able.

## Why no auth / DB / etc.

This is a v1 single-user internal artifact for an investor reapplication. Multi-tenancy and auth are deliberately out of scope.

If the dashboard becomes a product sold to other AI-native service teams (long-term), the JSON files will need to swap to a DB — change `lib/data.ts`, keep everything else.

## Honest framing

The dashboard reflects reality, not the deck. Today: few templates, most `prototype` maturity, founder-hours/$ is noisy. The *trajectory* and *target trendline* are the persuasive piece. Don't inflate the numbers — investors will cross-examine.
