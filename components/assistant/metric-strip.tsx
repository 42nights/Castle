import type { DigestSections } from "@/convex/dailyDigests";

export function MetricStrip({ metrics }: { metrics: DigestSections["metrics"] }) {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line rounded-lg overflow-hidden shadow-[var(--shadow-base)]"
      aria-label="Key metrics"
    >
      <MetricTile eyebrow="MRR" value={metrics.mrr} />
      <MetricTile eyebrow="ARR" value={metrics.arr} />
      <MetricTile
        eyebrow="Engagements"
        value={String(metrics.activeEngagements)}
        mono
      />
      <MetricTile
        eyebrow="Needs attention"
        value={String(metrics.attentionCount)}
        mono
        alert={metrics.attentionCount > 0}
      />
    </div>
  );
}

function MetricTile({
  eyebrow,
  value,
  mono,
  alert,
}: {
  eyebrow: string;
  value: string;
  mono?: boolean;
  alert?: boolean;
}) {
  return (
    <div className="bg-canvas px-5 py-4">
      <p className="t-eyebrow mb-2">{eyebrow}</p>
      <p
        className={`text-[22px] leading-tight tracking-[-0.02em] ${
          mono ? "font-mono tabular-nums" : "font-display"
        } ${alert ? "text-health-bad" : "text-ink"}`}
        style={
          !mono
            ? {
                fontFamily: "var(--font-display, Georgia, serif)",
                fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 0',
              }
            : undefined
        }
      >
        {value}
      </p>
    </div>
  );
}
