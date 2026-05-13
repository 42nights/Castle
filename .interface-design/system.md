# Castle · system

**Intent.** B2B operator console. Linear / Vercel / Stripe-dashboard idiom. Not editorial. Not notebook. Tight, terse, functional. The page reads like a tool, not a magazine.

**Color world.** Paper + ink + one red mark.

| Token | Value | Use |
| --- | --- | --- |
| `--page` | `#FFFFFF` | ground |
| `--surface` | `#FAFAF7` | hover row, dropdown |
| `--ink` | `#0A0A0A` | type, primary actions |
| `--ink-2` | `rgba(10,10,10,0.55)` | body 2 |
| `--ink-3` | `rgba(10,10,10,0.38)` | metadata |
| `--line` | `rgba(10,10,10,0.06)` | hairlines |
| `--line-strong` | `rgba(10,10,10,0.12)` | emphasis hairlines |
| `--accent` | `#D72638` | brand dot = critical state. Used ONCE per surface. |

**Signature.** The single red dot. Brand mark = critical state. Same atom.

**Type.** **Sans only.** No serif anywhere. Inter for everything. Tight scale, density first.
- `--text-page-title` 20px / 28px / -0.01em / weight 600 — h1
- `--text-section` 13px / 16px / 0.04em / weight 600 / UPPERCASE — section h2
- `--text-row-title` 14px / 20px / weight 500 — row headings
- `--text-body` 14px / 22px — body
- `--text-meta` 12px / 16px / --ink-3 — meta
- `--text-mono` 12px JetBrains Mono — numbers, slugs

JetBrains Mono stays — `num` class for tabular numerals on every numeric cell. That's how a B2B dashboard signals "this is data."

**Depth.** Borders + hairlines + surface tint. No drop shadows except dialog/dropdown.

**Spacing.** 4px base. Sections separated by 48px (was 64). Rows in a ledger 12-16px tall.

**Border use.** Hairlines, not boxes.
- Top nav bottom edge
- Page header bottom edge (1px ink-line under the h1)
- Between rows in a ledger
- Around dialogs / dropdowns only

**Rejected defaults (still rejected — these aren't the editorial choices, they're the dashboard choices).**
1. ❌ Card-grid for everything — sections divide by space.
2. ❌ Decorative eyebrow ornament — cut.
3. ❌ Always-visible inline phase/health controls — collapsed into a single ⋯ per card; data at rest.
4. ❌ Severity chips with labels ("Critical/High/Watch") — the pip IS the severity.
5. ❌ 5 stats — 4.
6. ❌ Serif display headings (Fraunces) — sans-only, smaller scale. The editorial register doesn't fit a B2B tool.

**Components.**
- **LedgerList** — single hairline between rows.
- **Stat** — number 24-32px (was 44), label 11px caption above. No box.
- **Pip** — 6px dot. `bg-ink` default, `bg-accent` for critical, `bg-ink-3` for muted.
- **InlineMenu (⋯)** — kebab → flyout. One per editable entity.
- **PageHeader** — small `Overview` label + sub. NOT a fancy display h1.

**Saved.** 2026-05-11. Rebuild #2 (B2B direction approved by Jerry, replaces the editorial direction).
