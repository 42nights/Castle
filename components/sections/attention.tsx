import Link from "next/link";
import { Avatar } from "@/components/atoms";
import { TouchedButton } from "@/components/controls/touched-button";
import type { AttentionItem, AttentionSeverity } from "@/lib/derive";

const SEVERITY_LABEL: Record<AttentionSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Watch",
};

/** Eyebrow color per severity group */
const SEVERITY_COLOR: Record<AttentionSeverity, string> = {
  critical: "text-health-bad",
  high: "text-health-warn",
  medium: "text-ink-3",
};

/** Pip background per severity */
const PIP_COLOR: Record<AttentionSeverity, string> = {
  critical: "bg-health-bad",
  high: "bg-health-warn",
  medium: "bg-ink-4",
};

const SEVERITY_ORDER: AttentionSeverity[] = ["critical", "high", "medium"];

export function AttentionList({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <section
        className="mb-8 rounded-lg bg-health-soft-good p-4 shadow-[var(--shadow-base)]"
        aria-label="Attention queue — all clear"
      >
        <p className="text-health-good text-[13px]">
          Nothing flagged. All engagements green, none stale beyond 7 days.
        </p>
      </section>
    );
  }

  // Group by severity
  const grouped = SEVERITY_ORDER.reduce<Record<AttentionSeverity, AttentionItem[]>>(
    (acc, sev) => {
      acc[sev] = items.filter((i) => i.severity === sev);
      return acc;
    },
    { critical: [], high: [], medium: [] },
  );

  const sectionsToRender = SEVERITY_ORDER.filter(
    (sev) => grouped[sev].length > 0,
  );

  return (
    <section className="mb-8" aria-label="Attention queue">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="t-h2">Needs attention</h2>
        <span className="font-mono tabular-nums text-[12px] text-ink-3">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {sectionsToRender.map((sev) => {
          const group = grouped[sev];
          return (
            <div key={sev}>
              {/* Fraunces eyebrow header per severity group */}
              <div
                className={`t-eyebrow mb-2 ${SEVERITY_COLOR[sev]}`}
                role="heading"
                aria-level={3}
              >
                {SEVERITY_LABEL[sev]} — {group.length}
              </div>

              <div className="rounded-lg bg-canvas shadow-[var(--shadow-base)] overflow-hidden">
                {group.map((item, i) => {
                  const engagementSlug = item.engagement?.id;
                  const showTouch =
                    engagementSlug &&
                    (item.id.startsWith("stale-") ||
                      item.id.startsWith("red-") ||
                      item.id.startsWith("yellow-"));
                  return (
                    <div
                      key={item.id}
                      className={`group flex items-center gap-4 px-4 py-3 hover:bg-surface-1 transition-colors duration-instant ${
                        i > 0 ? "border-t border-line" : ""
                      }`}
                    >
                      <SeverityDot severity={item.severity} pipColor={PIP_COLOR[sev]} />
                      <Link href={item.href} className="flex-1 min-w-0 block">
                        <div className="text-[13.5px] text-ink leading-snug truncate group-hover:underline underline-offset-2 decoration-line/40">
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
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SeverityDot({
  severity,
  pipColor,
}: {
  severity: AttentionSeverity;
  pipColor: string;
}) {
  return (
    <span
      className="relative flex h-2 w-2 shrink-0"
      aria-label={`Severity: ${SEVERITY_LABEL[severity]}`}
      role="img"
    >
      <span className={`absolute inset-0 rounded-full ${pipColor}`} />
      {severity === "critical" && (
        <span
          className={`absolute inset-0 rounded-full ${pipColor} motion-safe:animate-ping opacity-40`}
        />
      )}
    </span>
  );
}
