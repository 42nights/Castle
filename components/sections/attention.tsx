import Link from "next/link";
import { Avatar } from "@/components/atoms";
import { TouchedButton } from "@/components/controls/touched-button";
import type { AttentionItem, AttentionSeverity } from "@/lib/derive";

const severityLabel: Record<AttentionSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Watch",
};

export function AttentionList({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <section className="mb-8 border border-line rounded-md p-4 bg-surface">
        <div className="t-eyebrow mb-2">— What needs you today</div>
        <p className="text-ink-2 text-[14px]">
          Nothing flagged. Everything green, no engagement stale beyond 7 days.
        </p>
      </section>
    );
  }
  const counts = items.reduce<Record<AttentionSeverity, number>>(
    (acc, i) => ({ ...acc, [i.severity]: (acc[i.severity] ?? 0) + 1 }),
    { critical: 0, high: 0, medium: 0 }
  );

  return (
    <section className="mb-8">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="t-eyebrow mb-2">— What needs you today</div>
          <h2 className="t-h2 text-ink">Operator queue</h2>
        </div>
        <div className="t-caption flex items-center gap-3">
          {counts.critical > 0 && (
            <Badge severity="critical" count={counts.critical} />
          )}
          {counts.high > 0 && <Badge severity="high" count={counts.high} />}
          {counts.medium > 0 && <Badge severity="medium" count={counts.medium} />}
        </div>
      </div>

      <ul className="border-t border-line">
        {items.map((item) => {
          const engagementSlug = item.engagement?.id;
          const showTouch =
            engagementSlug &&
            (item.id.startsWith("stale-") ||
              item.id.startsWith("red-") ||
              item.id.startsWith("yellow-"));
          return (
            <li
              key={item.id}
              className="border-b border-line last:border-b-0 group"
            >
              <div className="grid grid-cols-[88px_1fr_auto] items-center gap-5 py-4 px-3 -mx-3 rounded-sm hover:bg-surface transition-colors">
                <SeverityChip severity={item.severity} />
                <Link href={item.href} className="min-w-0 block">
                  <div className="text-[14.5px] text-ink leading-tight hover:underline">
                    {item.title}
                  </div>
                  <p className="mt-1 text-[12.5px] text-ink-2 leading-relaxed line-clamp-2">
                    {item.subtitle}
                  </p>
                </Link>
                <div className="flex items-center gap-3">
                  {item.owner && (
                    <span className="inline-flex items-center gap-2">
                      <Avatar name={item.owner.name} size={20} />
                      <span className="t-caption">
                        {item.owner.name.split(" ")[0]}
                      </span>
                    </span>
                  )}
                  {showTouch && engagementSlug && (
                    <TouchedButton engagementSlug={engagementSlug} />
                  )}
                  <Link
                    href={item.href}
                    className="t-caption text-ink-3 group-hover:text-ink"
                  >
                    open →
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SeverityChip({ severity }: { severity: AttentionSeverity }) {
  const tone =
    severity === "critical"
      ? "bg-accent text-page"
      : severity === "high"
        ? "bg-ink text-page"
        : "border border-line text-ink-2 bg-page";
  return (
    <span
      className={`inline-flex h-5 w-fit items-center rounded-sm px-1.5 uppercase tracking-[0.08em] font-medium text-[10px] ${tone}`}
    >
      {severityLabel[severity]}
    </span>
  );
}

function Badge({
  severity,
  count,
}: {
  severity: AttentionSeverity;
  count: number;
}) {
  const dot =
    severity === "critical"
      ? "bg-accent"
      : severity === "high"
        ? "bg-ink"
        : "bg-ink-3";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="num text-ink">{count}</span>
      <span className="text-ink-3">{severityLabel[severity].toLowerCase()}</span>
    </span>
  );
}
