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
      <section className="mb-8 rounded-lg bg-surface p-4">
        <p className="text-ink-3 text-[13px]">
          Nothing flagged. All engagements green, none stale beyond 7 days.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="t-h2">Needs attention</h2>
        <span className="text-[12px] text-ink-3 num">{items.length} items</span>
      </div>

      <div className="rounded-lg border border-line overflow-hidden">
        {items.map((item, i) => {
          const engagementSlug = item.engagement?.id;
          const showTouch =
            engagementSlug &&
            (item.id.startsWith("stale-") ||
              item.id.startsWith("red-") ||
              item.id.startsWith("yellow-"));
          return (
            <div
              key={item.id}
              className={`group flex items-center gap-4 px-4 py-3 hover:bg-surface transition-colors ${i > 0 ? "border-t border-line" : ""}`}
            >
              <SeverityDot severity={item.severity} />
              <Link href={item.href} className="flex-1 min-w-0">
                <div className="text-[13.5px] text-ink leading-snug truncate group-hover:underline">
                  {item.title}
                </div>
                <p className="mt-0.5 text-[12px] text-ink-3 leading-snug truncate">
                  {item.subtitle}
                </p>
              </Link>
              <div className="flex items-center gap-3 shrink-0">
                {item.owner && (
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar name={item.owner.name} size={18} />
                    <span className="text-[12px] text-ink-3 hidden sm:inline">
                      {item.owner.name.split(" ")[0]}
                    </span>
                  </span>
                )}
                {showTouch && engagementSlug && (
                  <TouchedButton engagementSlug={engagementSlug} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SeverityDot({ severity }: { severity: AttentionSeverity }) {
  const color =
    severity === "critical"
      ? "bg-accent"
      : severity === "high"
        ? "bg-ink"
        : "bg-ink-3";
  return (
    <span
      className="relative flex h-2 w-2 shrink-0"
      title={severityLabel[severity]}
      aria-label={`Severity: ${severityLabel[severity]}`}
      role="img"
    >
      <span className={`absolute inset-0 rounded-full ${color}`} />
      {severity === "critical" && (
        <span className="absolute inset-0 rounded-full bg-accent animate-ping opacity-40" />
      )}
    </span>
  );
}
