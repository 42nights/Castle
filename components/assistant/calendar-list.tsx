import type { DigestSections } from "@/convex/dailyDigests";

type CalendarEvent = DigestSections["calendar"][number];

const TAG_STYLES: Record<CalendarEvent["tag"], { bg: string; text: string; label: string }> = {
  internal: {
    bg: "bg-surface-2",
    text: "text-ink-2",
    label: "Internal",
  },
  external: {
    bg: "bg-surface-2",
    text: "text-ink-2",
    label: "External",
  },
  "tier-1": {
    bg: "bg-health-soft-warn",
    text: "text-health-warn",
    label: "Tier 1",
  },
  investor: {
    bg: "bg-accent-soft",
    text: "text-accent-ink",
    label: "Investor",
  },
};

export function CalendarList({ events }: { events: CalendarEvent[] }) {
  return (
    <section aria-label="Today's calendar">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="t-h2">Today's calendar</h2>
        <span className="t-caption">{events.length} events</span>
      </div>
      <div className="rounded-lg bg-canvas shadow-[var(--shadow-base)] overflow-hidden">
        {events.map((event, i) => {
          const tag = TAG_STYLES[event.tag];
          return (
            <div
              key={i}
              className={`flex items-start gap-4 px-4 py-3 ${
                i > 0 ? "border-t border-line" : ""
              }`}
            >
              {/* Time */}
              <span className="font-mono text-[12px] tabular-nums text-ink-3 shrink-0 w-[58px] pt-0.5">
                {event.time}
              </span>

              {/* Title + location */}
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] text-ink leading-snug">{event.title}</p>
                {event.location && (
                  <p className="mt-0.5 text-[12px] text-ink-4 leading-snug">{event.location}</p>
                )}
              </div>

              {/* Tag */}
              <span
                className={`shrink-0 inline-flex h-5 items-center rounded-xs px-2 text-[10px] font-medium tracking-[0.06em] uppercase ${tag.bg} ${tag.text}`}
              >
                {tag.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
