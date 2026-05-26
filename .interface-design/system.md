# Castle - system

**Intent.** B2B operator console for an AI services company. Linear/Vercel idiom. Tight, terse, functional. The page tells the 42nights story: revenue, health, capacity, pipeline, flywheel.

**Color world.** Near-black ground, warm white ink, one red accent.

| Token | Value | Use |
| --- | --- | --- |
| `--page` | `#09090b` | ground |
| `--surface` | `#111113` | panels, cards, elevated areas |
| `--surface-2` | `#1a1a1e` | hover states on surface |
| `--ink` | `#fafafa` | primary text, interactive elements |
| `--ink-2` | `rgba(250,250,250,0.64)` | secondary text |
| `--ink-3` | `rgba(250,250,250,0.40)` | tertiary text, labels |
| `--line` | `rgba(250,250,250,0.08)` | hairlines, dividers |
| `--line-strong` | `rgba(250,250,250,0.16)` | emphasis dividers |
| `--accent` | `#ff3b47` | critical state, brand mark |
| `--ok` | `#22c55e` | healthy state |
| `--warn` | `#eab308` | warning state |

**Font.** Geist Sans + Geist Mono. Tight tracking, density first.
- `t-h1` 20px / 28px / -0.02em / weight 600
- `t-h2` 13px / 16px / 0.02em / weight 500 / UPPERCASE / ink-3
- `t-h3` 14px / 20px / weight 500
- `t-eyebrow` 11px / 14px / 0.04em / weight 500 / UPPERCASE / ink-3
- `t-caption` 12px / 16px / weight 400 / ink-3 / tabular-nums
- `.num` Geist Mono / tabular-nums

**Depth.** Rounded cards (8px radius) with subtle borders. Surface tint for elevation. No drop shadows except dialogs/popovers.

**Spacing.** 4px base. Panels separated by 16-24px. Rows 10-12px padding.

**Health pips.** 6px dot.
- green = `--ok` (not muted anymore)
- yellow = `--warn`
- red = `--accent`

**Overview narrative.** Top-to-bottom story:
1. Hero metrics (MRR hero + 4 mini stats + attention pills)
2. Attention queue (expandable list, severity dots with ping on critical)
3. Pipeline (4-column card grid, one per phase)
4. 2-column: Bench (FDE workload) | Flywheel (templates + extractions)
5. MRR trend (full-width chart with summary sidebar)

**Components.**
- **Panel/Card** — `rounded-lg bg-surface border border-line overflow-hidden`
- **Panel header** — `px-4 py-3 border-b border-line` with `t-h2` title
- **Ledger list** — hairline between rows, no outer border
- **Stat** — number 18-22px Geist Mono, label 11px uppercase above
- **Severity dot** — 8px, critical gets `animate-ping` overlay
- **Sparkline** — inline SVG, 200x32, opacity-40
- **Capacity bar** — 4px rounded, ink-2 fill, accent when overcommitted

**Top nav.** Sticky, `bg-page/80 backdrop-blur-xl`, 48px height. Active link gets `bg-surface rounded-md`. Cmd+K badge in rounded pill.

**Saved.** 2026-05-25. Rebuild #3 (narrative hierarchy redesign).
