import Link from "next/link";
import { Avatar } from "@/components/atoms";
import { FdeTagsChips } from "@/components/controls/fde-tags-input";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { FdeRow } from "@/lib/derive";
import { cn } from "@/lib/utils";

interface FdeCardGridProps {
  rows: FdeRow[];
}

/**
 * 2-column card grid for /fdes list.
 * Each card: Avatar 56px, name 18px, role, utilization ProgressBar, engagements, tags.
 */
export function FdeCardGrid({ rows }: FdeCardGridProps) {
  if (rows.length === 0) {
    return (
      <p className="text-ink-3 text-sm py-8">
        No FDEs yet — click + New FDE above.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {rows.map((r) => (
        <FdeCard key={r.fde.id} row={r} />
      ))}
    </div>
  );
}

function utilizationVariant(utilization: number): "default" | "good" | "warn" | "bad" {
  if (utilization > 1.05) return "bad";
  if (utilization >= 0.9) return "warn";
  if (utilization >= 0.6) return "good";
  return "default";
}

function FdeCard({ row }: { row: FdeRow }) {
  const { fde, workload } = row;
  const utilizationPct = Math.round(workload.utilization * 100);
  const variant = utilizationVariant(workload.utilization);

  return (
    <Link
      href={`/fdes/${fde.id}`}
      className="group block rounded-md bg-canvas border border-line shadow-[var(--shadow-base)] p-5 hover:shadow-[var(--shadow-md)] hover:-translate-y-px transition-[box-shadow,transform] duration-[var(--duration-base)] focus-visible:shadow-[var(--shadow-focus)] outline-none"
    >
      {/* Header: avatar + name + role */}
      <div className="flex items-start gap-4 mb-4">
        <Avatar name={fde.name} size={56} />
        <div className="flex-1 min-w-0">
          <div className="text-[18px] font-medium tracking-tight text-ink leading-snug">
            {fde.name}
          </div>
          <div className="text-[13px] text-ink-2 mt-0.5">
            {fde.role}
            {fde.is_founder && (
              <span className="ml-1.5 text-ink-3">· co-founder</span>
            )}
          </div>
        </div>
        {/* Utilization badge */}
        <div
          className={cn(
            "num text-[12px] font-medium shrink-0",
            workload.status === "overcommitted"
              ? "text-health-bad"
              : workload.status === "at capacity"
              ? "text-health-warn"
              : "text-ink-3",
          )}
        >
          {utilizationPct}%
        </div>
      </div>

      {/* Capacity bar */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="t-meta text-ink-3">Capacity</span>
          <span className="num text-[11px] text-ink-3">
            {Math.round(workload.committedHours)}h / {fde.capacity_hours_per_week}h
          </span>
        </div>
        <ProgressBar
          value={Math.min(100, utilizationPct)}
          variant={variant}
          segmented
          aria-label={`${fde.name} capacity: ${utilizationPct}%`}
        />
      </div>

      {/* Active engagements */}
      {workload.activeEngagements.length > 0 && (
        <div className="mb-3">
          <div className="t-meta text-ink-3 mb-1.5">Active</div>
          <div className="space-y-1">
            {workload.activeEngagements.slice(0, 3).map((e) => (
              <div key={e.id} className="text-[12.5px] text-ink-2 truncate">
                · {e.customer_id}
              </div>
            ))}
            {workload.activeEngagements.length > 3 && (
              <div className="text-[12px] text-ink-3">
                +{workload.activeEngagements.length - 3} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tags */}
      {fde.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-3 border-t border-line">
          <FdeTagsChips tags={fde.tags} max={5} />
        </div>
      )}
    </Link>
  );
}
