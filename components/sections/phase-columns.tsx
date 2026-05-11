import Link from "next/link";
import {
  AvatarGroup,
  HealthPip,
} from "@/components/atoms";
import { HealthMenu } from "@/components/controls/health-menu";
import { PhaseMenu } from "@/components/controls/phase-menu";
import { ProgressSlider } from "@/components/controls/progress-slider";
import { TouchedButton } from "@/components/controls/touched-button";
import type { EngagementRow } from "@/lib/derive";
import { daysSince } from "@/lib/derive";
import type { EngagementPhase } from "@/lib/types";
import { formatHours } from "@/lib/format";

const COLUMNS: { key: EngagementPhase; label: string; sub: string }[] = [
  { key: "discovery", label: "Discovery", sub: "Scoping" },
  { key: "build", label: "Build", sub: "Active work" },
  { key: "deployed", label: "Deployed", sub: "Live & supported" },
];

const STALE_THRESHOLD = 7;

export function PhaseColumns({
  groups,
  today = new Date(),
}: {
  groups: Record<EngagementPhase, EngagementRow[]>;
  today?: Date;
}) {
  return (
    <section className="mb-14">
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="t-eyebrow mb-2">— Engagements · pipeline</div>
          <h2 className="t-h2 text-ink">By phase, right now.</h2>
        </div>
        <Link
          href="/engagements"
          className="t-caption text-ink-2 hover:text-ink"
        >
          full table →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-line border border-line rounded-sm overflow-hidden">
        {COLUMNS.map((col) => {
          const rows = groups[col.key] ?? [];
          return (
            <div key={col.key} className="bg-page p-4 flex flex-col">
              <header className="px-1 mb-3 flex items-baseline justify-between">
                <div>
                  <div className="t-h3">{col.label}</div>
                  <div className="t-caption text-ink-3">{col.sub}</div>
                </div>
                <span className="num text-ink-3 text-[13px]">{rows.length}</span>
              </header>
              <ol className="flex flex-col gap-2.5">
                {rows.length === 0 && (
                  <li className="t-caption text-ink-3 italic p-3">
                    nothing here
                  </li>
                )}
                {rows.map(({ engagement: e, customer, fdes }) => {
                  const stale = daysSince(e.last_update_at, today);
                  const isStale = stale > STALE_THRESHOLD;
                  return (
                    <li key={e.id}>
                      <div className="block border border-line rounded-sm p-3 hover:bg-surface transition-colors">
                        <div className="flex items-center justify-between gap-3">
                          <Link
                            href={`/engagements/${e.id}`}
                            className="text-ink text-[14px] truncate hover:underline"
                          >
                            {customer.name}
                          </Link>
                          <HealthPip value={e.health} />
                        </div>
                        <div className="mt-3">
                          <ProgressSlider
                            engagementSlug={e.id}
                            current={e.progress_pct}
                          />
                        </div>
                        <div className="mt-3 flex items-center justify-between t-caption">
                          <AvatarGroup names={fdes.map((f) => f.name)} />
                          <span className="text-ink-3">
                            <span className="num">{formatHours(e.weekly_hours)}</span>
                            /wk
                          </span>
                        </div>
                        <div className="mt-3 pt-3 border-t border-line flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <PhaseMenu
                              engagementSlug={e.id}
                              current={e.phase}
                            />
                            <HealthMenu
                              engagementSlug={e.id}
                              current={e.health}
                            />
                          </div>
                          <TouchedButton engagementSlug={e.id} />
                        </div>
                        <div className="mt-2 t-caption flex items-center justify-between">
                          <span
                            className={
                              isStale ? "text-accent" : "text-ink-3"
                            }
                          >
                            {isStale ? "stalled · " : "updated · "}
                            <span className="num">{stale}d</span>
                          </span>
                          {isStale && (
                            <span className="inline-flex h-4 items-center rounded-sm border border-accent px-1 uppercase tracking-[0.1em] text-[9px] font-medium text-accent">
                              stalled
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
    </section>
  );
}
