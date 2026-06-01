import Link from "next/link";
import { EngagementMenu } from "@/components/controls/engagement-menu";
import { daysSince } from "@/lib/derive";
import type { EngagementRow } from "@/lib/derive";
import type { EngagementPhase } from "@/lib/types";
import { formatHours } from "@/lib/format";

type PhaseConfig = {
  key: EngagementPhase;
  label: string;
  /** Eyebrow accent color class */
  eyebrowColor: string;
  /** Count badge background */
  badgeBg: string;
  /** Count badge text */
  badgeText: string;
};

const COLUMNS: PhaseConfig[] = [
  {
    key: "discovery",
    label: "Discovery",
    eyebrowColor: "text-ink-3",
    badgeBg: "bg-surface-2",
    badgeText: "text-ink-3",
  },
  {
    key: "build",
    label: "Build",
    eyebrowColor: "text-health-warn",
    badgeBg: "bg-health-soft-warn",
    badgeText: "text-health-warn",
  },
  {
    key: "deployed",
    label: "Deployed",
    eyebrowColor: "text-health-good",
    badgeBg: "bg-health-soft-good",
    badgeText: "text-health-good",
  },
  {
    key: "support",
    label: "Support",
    eyebrowColor: "text-ink-2",
    badgeBg: "bg-surface-2",
    badgeText: "text-ink-2",
  },
];

const STALE_THRESHOLD = 7;

export function PhaseColumns({
  groups,
  today = new Date(),
}: {
  groups: Record<EngagementPhase, EngagementRow[]>;
  today?: Date;
}) {
  const total = Object.values(groups).reduce((s, g) => s + g.length, 0);

  return (
    <section className="mb-8" aria-label="Engagement pipeline by phase">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="t-h2">
          Pipeline
          <span className="ml-2 font-mono tabular-nums text-ink-3">{total}</span>
        </h2>
        <Link
          href="/engagements"
          className="text-[12px] text-ink-3 hover:text-ink transition-colors duration-instant"
        >
          full table
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {COLUMNS.map((col) => {
          const rows = groups[col.key] ?? [];
          return (
            <div
              key={col.key}
              className="rounded-lg bg-canvas shadow-[var(--shadow-base)] overflow-hidden"
            >
              <header className="flex items-center justify-between px-3 py-2.5 border-b border-line">
                <Link
                  href={`/engagements?eng.phase=${col.key}`}
                  className={`t-eyebrow ${col.eyebrowColor} hover:text-ink transition-colors duration-instant`}
                  aria-label={`Filter engagements by ${col.label} phase`}
                >
                  {col.label}
                </Link>
                <span
                  className={`inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-mono tabular-nums font-medium ${col.badgeBg} ${col.badgeText}`}
                  aria-label={`${rows.length} engagements`}
                >
                  {rows.length}
                </span>
              </header>

              {rows.length === 0 ? (
                <p className="px-3 py-4 text-[12px] text-ink-3">No engagements</p>
              ) : (
                <ol>
                  {rows.map(({ engagement: e, customer, fdes }, i) => {
                    const stale = daysSince(e.last_update_at, today);
                    const isStale = stale > STALE_THRESHOLD;
                    return (
                      <li
                        key={e.id}
                        className={`group px-3 py-2.5 hover:bg-surface-1 transition-colors duration-instant ${
                          i > 0 ? "border-t border-line" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            href={`/engagements/${e.id}`}
                            className="flex items-center gap-2 min-w-0 text-[13px] text-ink hover:underline underline-offset-2 decoration-line/40"
                          >
                            <span
                              className="hp flex-shrink-0"
                              data-health={e.health}
                              aria-label={`Health: ${e.health}`}
                            />
                            <span className="truncate">{customer.name}</span>
                          </Link>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-instant">
                            <EngagementMenu
                              engagementSlug={e.id}
                              currentPhase={e.phase}
                              currentHealth={e.health}
                              currentProgress={e.progress_pct}
                            />
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div
                          className="mt-2 h-[2px] rounded-full bg-line relative overflow-hidden"
                          aria-label={`Progress: ${e.progress_pct}%`}
                          role="progressbar"
                          aria-valuenow={e.progress_pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <span
                            className="absolute inset-y-0 left-0 rounded-full bg-ink-3 transition-all duration-slow"
                            style={{ width: `${e.progress_pct}%` }}
                          />
                        </div>

                        <div className="mt-1.5 flex items-baseline justify-between text-[11px] text-ink-3">
                          <span className="truncate">
                            {fdes.map((f) => f.name.split(" ")[0]).join(", ")}
                          </span>
                          <span className="font-mono tabular-nums shrink-0">
                            {formatHours(e.weekly_hours)}/w
                          </span>
                        </div>

                        {isStale && (
                          <div className="mt-1 text-[11px] text-health-warn">
                            stale <span className="font-mono tabular-nums">{stale}d</span>
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
