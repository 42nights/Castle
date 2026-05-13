import Link from "next/link";
import { EngagementMenu } from "@/components/controls/engagement-menu";
import { daysSince } from "@/lib/derive";
import type { EngagementRow } from "@/lib/derive";
import type { EngagementPhase } from "@/lib/types";
import { formatHours } from "@/lib/format";

const COLUMNS: { key: EngagementPhase; label: string }[] = [
  { key: "discovery", label: "Discovery" },
  { key: "build", label: "Build" },
  { key: "deployed", label: "Deployed" },
  { key: "support", label: "Support" },
];

const STALE_THRESHOLD = 7;

/**
 * Engagement pipeline by phase.
 *
 * Each phase = one column with no surrounding box. Each engagement = a
 * paragraph, not a card. Hairlines between rows inside a column. All
 * controls collapsed into a hover-revealed ⋯ button — at rest, the
 * row reads as a sentence the operator can scan.
 *
 * Progress is a 2px line at rest. Open the menu to change.
 */
export function PhaseColumns({
  groups,
  today = new Date(),
}: {
  groups: Record<EngagementPhase, EngagementRow[]>;
  today?: Date;
}) {
  return (
    <section className="panel mb-4">
      <header className="panel-header">
        <h2 className="t-h2 text-ink">Pipeline</h2>
        <Link
          href="/engagements"
          className="text-[12px] text-ink-3 hover:text-ink"
        >
          full table →
        </Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-x divide-line">
        {COLUMNS.map((col) => {
          const rows = groups[col.key] ?? [];
          return (
            <div key={col.key} className="min-w-0">
              <header className="flex items-baseline justify-between px-3 py-2 border-b border-line">
                <h3 className="text-[12px] tracking-[0.04em] text-ink uppercase font-medium">
                  {col.label}
                </h3>
                <span className="text-[11px] text-ink-3 num">
                  {rows.length}
                </span>
              </header>

              {rows.length === 0 ? (
                <p className="px-3 py-2 text-[12px] text-ink-3">—</p>
              ) : (
                <ol className="ledger">
                  {rows.map(({ engagement: e, customer, fdes }) => {
                    const stale = daysSince(e.last_update_at, today);
                    const isStale = stale > STALE_THRESHOLD;
                    const pip =
                      e.health === "red"
                        ? "red"
                        : e.health === "yellow"
                          ? "yellow"
                          : undefined;
                    return (
                      <li
                        key={e.id}
                        className="group px-3 py-2 hover:bg-surface"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <Link
                            href={`/engagements/${e.id}`}
                            className="text-[13.5px] text-ink truncate flex items-baseline gap-2 min-w-0 hover:underline"
                          >
                            <span
                              className="hp inline-block translate-y-[1px] flex-shrink-0"
                              data-health={pip}
                            />
                            <span className="truncate">{customer.name}</span>
                          </Link>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <EngagementMenu
                              engagementSlug={e.id}
                              currentPhase={e.phase}
                              currentHealth={e.health}
                              currentProgress={e.progress_pct}
                            />
                          </div>
                        </div>

                        <div className="mt-1.5 h-px bg-line relative overflow-hidden">
                          <span
                            className="absolute inset-y-0 left-0 bg-ink"
                            style={{ width: `${e.progress_pct}%` }}
                          />
                        </div>

                        <div className="mt-1 flex items-baseline justify-between text-[11.5px] text-ink-3">
                          <span className="truncate">
                            {fdes.map((f) => f.name.split(" ")[0]).join(" · ")}
                          </span>
                          <span className="num">
                            {formatHours(e.weekly_hours)}/wk
                          </span>
                        </div>

                        {isStale && (
                          <div className="mt-0.5 text-[11px] text-accent">
                            stale · <span className="num">{stale}d</span>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
