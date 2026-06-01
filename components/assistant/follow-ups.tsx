import type { DigestSections } from "@/convex/dailyDigests";

type FollowUp = DigestSections["followUps"][number];

export function FollowUps({ items }: { items: FollowUp[] }) {
  const open = items.filter((f) => !f.done);
  return (
    <section aria-label="Open follow-ups">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="t-h2">Open follow-ups</h2>
        <span className="t-caption">{open.length} open</span>
      </div>
      <div className="rounded-lg bg-canvas shadow-[var(--shadow-base)] overflow-hidden">
        {items.map((item, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-3 ${
              i > 0 ? "border-t border-line" : ""
            } ${item.done ? "opacity-50" : ""}`}
          >
            {/* Checkbox-style indicator */}
            <span
              className={`shrink-0 h-4 w-4 rounded-sm border flex items-center justify-center ${
                item.done
                  ? "border-health-good bg-health-soft-good"
                  : "border-line bg-surface-1"
              }`}
              aria-hidden
            >
              {item.done && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden>
                  <path
                    d="M1 4L3.5 6.5L9 1"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-health-good"
                  />
                </svg>
              )}
            </span>

            <p className="flex-1 text-[13.5px] text-ink leading-snug">{item.title}</p>

            <span
              className={`shrink-0 font-mono text-[11px] tabular-nums ${
                item.dueDate === "Today"
                  ? "text-health-bad font-medium"
                  : "text-ink-3"
              }`}
            >
              {item.dueDate}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
