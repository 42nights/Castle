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

export function PhaseColumns({
  groups,
  today = new Date(),
}: {
  groups: Record<EngagementPhase, EngagementRow[]>;
  today?: Date;
}) {
  const total = Object.values(groups).reduce((s, g) => s + g.length, 0);

  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="t-h2">
          Pipeline
          <span className="ml-2 num text-ink-3">{total}</span>
        </h2>
        <Link
          href="/engagements"
          className="text-[12px] text-ink-3 hover:text-ink transition-colors"
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
              className="rounded-lg bg-surface border border-line overflow-hidden"
            >
              <header className="flex items-baseline justify-between px-3 py-2.5 border-b border-line">
                <h3 className="text-[12px] tracking-wide text-ink-2 uppercase font-medium">
                  {col.label}
                </h3>
                <span className="num text-[12px] text-ink-3">
                  {rows.length}
                </span>
              </header>

              {rows.length === 0 ? (
                <p className="px-3 py-3 text-[12px] text-ink-3">No engagements</p>
              ) : (
                <ol>
                  {rows.map(({ engagement: e, customer, fdes }, i) => {
                    const stale = daysSince(e.last_update_at, today);
                    const isStale = stale > STALE_THRESHOLD;
                    return (
                      <li
                        key={e.id}
                        className={`group px-3 py-2.5 hover:bg-surface-2 transition-colors ${i > 0 ? "border-t border-line" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            href={`/engagements/${e.id}`}
                            className="flex items-center gap-2 min-w-0 text-[13px] text-ink hover:underline"
                          >
                            <span
                              className="hp flex-shrink-0"
                              data-health={e.health}
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

                        <div className="mt-2 h-[2px] rounded-full bg-line relative overflow-hidden">
                          <span
                            className="absolute inset-y-0 left-0 rounded-full bg-ink-2"
                            style={{ width: `${e.progress_pct}%` }}
                          />
                        </div>

                        <div className="mt-1.5 flex items-baseline justify-between text-[11px] text-ink-3">
                          <span className="truncate">
                            {fdes.map((f) => f.name.split(" ")[0]).join(", ")}
                          </span>
                          <span className="num shrink-0">
                            {formatHours(e.weekly_hours)}/w
                          </span>
                        </div>

                        {isStale && (
                          <div className="mt-1 text-[11px] text-accent">
                            stale <span className="num">{stale}d</span>
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
