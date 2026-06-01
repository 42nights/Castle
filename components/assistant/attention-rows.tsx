import Link from "next/link";
import type { DigestSections } from "@/convex/dailyDigests";

type AttentionItem = DigestSections["attention"][number];

const SEV_PIP: Record<AttentionItem["severity"], string> = {
  critical: "bg-health-bad",
  high: "bg-health-warn",
  medium: "bg-ink-4",
};

const SEV_LABEL: Record<AttentionItem["severity"], string> = {
  critical: "Critical",
  high: "High",
  medium: "Watch",
};

const SEV_TEXT: Record<AttentionItem["severity"], string> = {
  critical: "text-health-bad",
  high: "text-health-warn",
  medium: "text-ink-3",
};

export function AttentionRows({ items }: { items: AttentionItem[] }) {
  return (
    <section aria-label="Castle attention items">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="t-h2">Castle attention</h2>
        <span className="t-caption">{items.length} items</span>
      </div>
      <div className="rounded-lg bg-canvas shadow-[var(--shadow-base)] overflow-hidden">
        {items.map((item, i) => (
          <Link
            key={i}
            href={item.href}
            className={`group flex items-start gap-3 px-4 py-3 hover:bg-surface-1 transition-colors duration-[100ms] ${
              i > 0 ? "border-t border-line" : ""
            }`}
          >
            {/* Severity pip */}
            <span className="relative flex h-2 w-2 shrink-0 mt-1.5" aria-label={SEV_LABEL[item.severity]}>
              <span className={`absolute inset-0 rounded-full ${SEV_PIP[item.severity]}`} />
              {item.severity === "critical" && (
                <span
                  className={`absolute inset-0 rounded-full ${SEV_PIP[item.severity]} motion-safe:animate-ping opacity-40`}
                />
              )}
            </span>

            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] text-ink leading-snug group-hover:underline underline-offset-2 decoration-line/40">
                {item.title}
              </p>
              <p className="mt-0.5 text-[12px] text-ink-3 leading-snug">{item.subtitle}</p>
            </div>

            <span className={`shrink-0 text-[11px] font-medium tracking-[0.04em] uppercase ${SEV_TEXT[item.severity]}`}>
              {SEV_LABEL[item.severity]}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
