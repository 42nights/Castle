"use client";

import Link from "next/link";
import { HealthPip, PhaseBadge } from "@/components/atoms";
import { WeeklyHoursInput } from "@/components/controls/weekly-hours-input";
import type { Engagement } from "@/lib/types";
import { formatDate } from "@/lib/format";

interface EngagementCardsProps {
  engagements: Engagement[];
}

/**
 * Hero card grid showing engagements on a customer detail page.
 * Each card shows: phase chip + health pip, dates, notes preview, weekly hours.
 * Cards link to the engagement detail.
 */
export function EngagementCards({ engagements }: EngagementCardsProps) {
  if (engagements.length === 0) {
    return (
      <p className="text-ink-3 text-sm py-4">
        No engagements logged.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {engagements.map((e) => (
        <Link
          key={e.id}
          href={`/engagements/${e.id}`}
          className="group block rounded-md bg-canvas border border-line shadow-[var(--shadow-base)] p-5 hover:shadow-[var(--shadow-md)] hover:-translate-y-px transition-[box-shadow,transform] duration-[var(--duration-base)] focus-visible:shadow-[var(--shadow-focus)] outline-none"
        >
          {/* Card header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <PhaseBadge phase={e.phase} />
              <span className="num text-[12px] text-ink-3">{e.progress_pct}%</span>
            </div>
            <HealthPip value={e.health} />
          </div>

          {/* Notes preview */}
          <p className="text-[13px] text-ink-2 line-clamp-2 leading-relaxed mb-3">
            {e.notes || <span className="text-ink-3 italic">No notes yet.</span>}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3">
            <span className="t-caption num">
              {formatDate(e.start_date)} → {formatDate(e.expected_end_date)}
            </span>
            <span
              className="text-[12px] text-ink-2 inline-flex items-baseline gap-0.5"
              onClick={(ev) => ev.preventDefault()}
            >
              <WeeklyHoursInput
                engagementSlug={e.id}
                current={e.weekly_hours}
              />
              <span>/wk</span>
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
