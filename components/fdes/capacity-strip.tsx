import { CapacityInput } from "@/components/controls/capacity-input";
import { LogHoursButton } from "@/components/controls/log-hours-button";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { FDE, Engagement } from "@/lib/types";
import { formatHours } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CapacityStripProps {
  fde: FDE;
  activeEngagements: Engagement[];
}

/**
 * Capacity strip for /fdes/[slug].
 * Shows this-week hours vs capacity as a ProgressBar with per-engagement markers.
 * Inline-editable capacity via CapacityInput.
 */
export function CapacityStrip({ fde, activeEngagements }: CapacityStripProps) {
  const capacity = fde.capacity_hours_per_week;
  const utilPct = capacity > 0 ? Math.min(100, (fde.hours_this_week / capacity) * 100) : 0;
  const isOver = fde.hours_this_week > capacity;

  return (
    <div className="rounded-md bg-canvas border border-line shadow-[var(--shadow-base)] px-5 py-4 mb-6">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h2 className="t-h2">Capacity this week</h2>
        <div className="flex items-baseline gap-1.5 text-[13px]">
          <span
            className={cn(
              "num font-semibold text-[18px]",
              isOver ? "text-health-bad" : "text-ink",
            )}
          >
            {formatHours(fde.hours_this_week)}
          </span>
          <span className="text-ink-3">of</span>
          <CapacityInput fdeSlug={fde.id} current={capacity} />
          <LogHoursButton fdeSlug={fde.id} />
        </div>
      </div>

      {/* Main bar */}
      <ProgressBar
        value={utilPct}
        variant={isOver ? "bad" : utilPct >= 90 ? "warn" : "good"}
        aria-label={`${fde.name} capacity: ${Math.round(utilPct)}%`}
        className="mb-3"
      />

      {/* Per-engagement breakdown */}
      {activeEngagements.length > 0 && (
        <div className="space-y-1.5 pt-3 border-t border-line">
          {activeEngagements.map((e) => {
            const engHours = e.weekly_hours / Math.max(1, e.fde_ids.length);
            const engPct = capacity > 0 ? (engHours / capacity) * 100 : 0;
            return (
              <div key={e.id} className="flex items-center gap-3">
                <span className="text-[12px] text-ink-2 w-40 truncate shrink-0">
                  {e.customer_id}
                </span>
                <div className="flex-1">
                  <ProgressBar
                    value={Math.min(100, engPct)}
                    variant="default"
                    aria-label={`${e.customer_id}: ${formatHours(engHours)}`}
                  />
                </div>
                <span className="num text-[11px] text-ink-3 w-8 text-right shrink-0">
                  {formatHours(engHours)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
