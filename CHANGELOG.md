# Changelog

A linear log of substantive phases. Read top-to-bottom for the project's
arc, or use `git log --oneline` for the same info compressed.

---

## v0 — read-only Castle

**v0.0 — Initial commit** ([3cf16e6](https://github.com/local/v0.0))
- Static read-only multi-route SaaS over `data/*.json` fixtures.
- Light-mode Paper design system (Fraunces + Inter + JetBrains Mono).
- Overview operator console (attention queue, stats, FDE workload, phase
  columns, founder leverage chart, templates, extractions).
- Routes: `/`, `/fdes`, `/fdes/[id]`, `/engagements`, `/engagements/[id]`,
  `/customers`, `/customers/[id]`, `/templates`, `/templates/[id]`,
  `/extractions`.
- Pure-derived management logic in `lib/derive.ts`.

## v1 — Convex migration (P0 – P12)

**P0 — Convex backend scaffolding** ([3cf16e6](https://github.com/local/P0))
- `convex/schema.ts`: 12 tables incl. junctions (`engagement_assignments`,
  `template_capabilities`, `pattern_extraction_reuses`).
- Per-table CRUD + state mutations: `markTouched`, `movePhase`,
  `setProgress`, `setHealth`, `reassign`, `saveNotes` (with notes_version
  optimistic concurrency), `extract` flow with optional inline template.
- Slug uniqueness enforced transactionally (`-2`, `-3` suffix).
- `convex/_generated/` hand-written shim (later replaced by real codegen).
- ConvexClientProvider in layout; `.env.local.example` added.
- `scripts/seed-convex.mjs` reads `data/*.json` and pipes to
  `seed:importPayload` mutation. Idempotent.
- Route rename `[id]` → `[slug]` across customers/engagements/fdes/templates.

**P0.7 — Overview migrated to preloadQuery + JSON fallback** ([59c9018](https://github.com/local/P0.7))
- `app/page.tsx` env-routes: Convex URL set → preloadQuery + OverviewIsland
  for live reactivity; unset → `loadAll()` + OverviewSections.
- `lib/adapters.ts`: ConvexOverview → AdaptedOverview shim so
  `lib/derive.ts` runs over either source.

**P1 — Engagement mutations + interactive controls** ([b9725e4](https://github.com/local/P1))
- Provider always wraps in ConvexProvider (placeholder URL when env
  missing) so `useQuery` doesn't crash during prerender.
- ActorBar in nav (FDE picker, localStorage-backed).
- Toast (shadcn sonner) + `useRunMutation` wrapper.
- Controls: TouchedButton, PhaseMenu, HealthMenu, ProgressSlider,
  NotesEditor (autosave + notes_version stale rejection).
- PhaseColumns + AttentionList wired with controls.

**P2 — Customer + FDE state controls** ([190b259](https://github.com/local/P2))
- CustomerHealthMenu, CustomerStatusMenu, MrrInput inline in
  customer list.
- CapacityInput + LogHoursButton inline on FDE workload cards.

**P3 — Dialogs: founder hours, +Engagement, +Extract** ([e50945e](https://github.com/local/P3))
- `components/ui/dialog.tsx` minimal modal (no Radix).
- LogFounderMonthDialog (chart "+ Log this month").
- CreateEngagementDialog.
- ExtractPatternDialog (source picker, summary auto-fill,
  existing-or-new template).

**P4 — Attention plumbing + ⌘K palette** ([596d764](https://github.com/local/P4))
- AttentionListLive: live `attention.list({ nowBucket })` with snooze/
  resolve/touched-today.
- ManualAttentionDialog.
- CommandPalette (⌘K): + actions + Go: navigation.

**P5 — README rewrite** ([8267f9e](https://github.com/local/P5))
- Documented Convex bootstrap, fallback path, data model, architecture.

**P6 — Full create-dialog coverage + reassign + audit timeline + detail edits** ([16eb09f](https://github.com/local/P6))
- CreateCustomerDialog, CreateFdeDialog, CreateTemplateDialog,
  CreateDeploymentDialog.
- ReassignEngagementDialog (chip-toggle multi-select).
- Engagement detail: + Deployment, Reassign, + Extract pattern buttons.
  EngagementTimeline (audit log).
- Customer + FDE detail: inline state controls wired in headers.

**P7 — Editable templates, list-inline edits, notes journal, URL filters** ([5f7b251](https://github.com/local/P7))
- CapabilityEditor with add/edit/reorder (swap)/remove.
- `/engagements` list: phase + health columns now inline menus +
  per-row TouchedButton.
- NotesJournal panel on engagement detail.
- DataTable accepts `urlKey` to sync state to search params.
  force-dynamic on list pages (useSearchParams).

**P8 — Keyboard shortcuts + inline engagement fields + FDE activity** ([f53e567](https://github.com/local/P8))
- EngagementKeys: `u` = mark touched.
- WeeklyHoursInput, EndDateInput inline.
- `engagements.listUpdatesByActor` query + FdeActivity panel.

**P9 — Deployment edit/remove + InlineName + delete with confirm** ([9acb4cf](https://github.com/local/P9))
- EditDeploymentDialog with remove action.
- InlineName for customer/FDE/template detail headers.
- DeleteEngagementZone (type-the-name confirm, cascades).

**P10 — Empty states + in-flight pulse + smoke test + memory** ([0761218](https://github.com/local/P10))
- Empty-state CTAs on list tables.
- InFlightDot pulse in TopNav.
- All 10 routes smoke-tested through JSON fallback.

**P11 — Rip out the shim, real local Convex deployment** ([c81509a](https://github.com/local/P11))
- `npx convex dev --once --configure new --dev-deployment local --project castle`
  bootstraps a fully local backend with zero cloud login.
- `_generated/` shim deleted; real codegen takes over.
- pnpm seed:convex round-trips successfully.
- React 19 strict-mode cleanups: useSyncedDraft hook,
  useSyncExternalStore for useActor, NotesEditor refactor.
- 36 lint problems → 5 harmless warnings.

**P12 — Every page now reads Convex** ([ae44da3](https://github.com/local/P12))
- Found bug: inline edits hit Convex but only `/` was preloading from
  Convex. Other pages still pulled JSON. Eragon's MRR was `$7,777` in
  Convex but `/customers` showed `$3,500`.
- New `lib/load-overview.ts` env-routes between Convex `fetchQuery` +
  adapter or JSON fallback. Every list/detail page migrated.
- `useRunMutation` calls `router.refresh()` post-success.

## v2 — codex-driven hardening (P13 – P22)

**P13 — Codex pass #1: Convex backend** ([e33c224](https://github.com/local/P13))
1. Support-phase progress invariant enforced in `create` + `setProgress`.
2. Reassign dedupes input + resurrects removed rows.
3. Snooze precision uses server `Date.now()`, not minute-floor bucket.
4. Seed idempotency checks all 7 root tables.

**P14 — Codex pass #2: Frontend (two sub-passes, 9 bugs)** ([25ebffa](https://github.com/local/P14))
1. fetchQuery/preloadQuery wrapped in try/catch with JSON fallback.
2. Template.created_at uses seed date not Convex `_creationTime`.
3. NotesEditor adoption uses `notes_version` not Doc reference.
4. CapabilityEditor reorder via atomic `swapCapabilityPositions`.
5/6/7. LogFounderMonth/EditDeployment/ExtractPattern dialogs reset
state when `open` transitions to true.
8. ExtractPatternButton: `sourceEngagementSlug` not `sourceEngagementId`.
9. `summarySeededFor` resets on dialog close.

**P15 — Codex pass #3: silent calc bugs** ([eaf76df](https://github.com/local/P15))
1. atRiskArr includes paused (was excluded).
2. daysSince clamps future timestamps to 0.
3. founderHoursSeries dedupes duplicate months.
4. adaptOverview nulls out deployment.template_id when template deleted.

**P16 — Codex pass #4: schema-level bounds + cascade** ([193bb7f](https://github.com/local/P16))
1. `convex/lib/bounds.ts`: checkNonNegative, checkPercent, checkInteger,
   checkSlug. Wired into every create + update path.
2. saveNotes distinct INVALID_BASE_VERSION error for ahead-of-server.
3. uniqueSlug refuses empty/placeholder base.
4. engagements.remove cascades pattern_extractions + their reuses.

**P17 — vitest suite for pure compute** ([0dd380c](https://github.com/local/P17))
- 30 tests in `lib/derive.test.ts` + `lib/adapters.test.ts`.
- Locks every P15 fix with a specific test.

**P18 — convex-test backend suite** ([3940920](https://github.com/local/P18))
- 17 tests in `convex/engagements.test.ts`.
- JSX-in-try/catch lint fix on `app/page.tsx`.

**P19 — attention + seed backend tests** ([…](https://github.com/local/P19))
- 13 tests for `attention.list` derivation + snooze/resolve/manual items
  + seed idempotency across non-fdes tables.

**P20 — cross-surface backend tests** ([…](https://github.com/local/P20))
- 15 tests across customers / fdes / templates / deployments /
  patternExtractions / founderHours mutation surfaces.

**P21 — Convex-unreachable round-trip + fallback test** ([…](https://github.com/local/P21))
- Killed Convex, hit every route → all 200 from JSON fallback (P14 #1
  fix verified live).
- `lib/load-overview.test.ts` (3 tests): env-unset path, fetchQuery
  throws path, fetchQuery resolves path.
- `server-only` aliased to no-op in vitest.

**P22 — Codex pass #8: seed/data/format/extraction-timeline** ([…](https://github.com/local/P22))
1. seed.ts shape guards on every root array.
2. seed.ts throws on bad template ref (not silent null).
3. lib/data.ts try/catch with empty default per loader.
4. extraction-timeline broken link → plain italic text.
5. formatUsdCompact boundary fix (999_500–999_999 → $1M, not $1000K).
- `lib/format.test.ts` (14 tests) including the regression case.

---

## Totals at last verified iteration

- **Phases**: P0 → P22
- **Tests**: 92 across 7 files (~299ms wall)
- **Codex passes**: 8 (26 real bugs found and fixed)
- **Build / tsc / lint**: clean throughout
