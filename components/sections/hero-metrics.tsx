"use client";

import { useSyncExternalStore } from "react";
import type { MrrPoint } from "@/lib/derive";
import { formatPct, formatUsdCompact } from "@/lib/format";

export function HeroMetrics({
  mrr,
  mrrDelta,
  mrrPoints,
  payingCustomers,
  contractedArr,
  atRiskArr,
  utilization,
  attentionCount,
  criticalCount,
}: {
  mrr: number;
  mrrDelta: number;
  mrrPoints: MrrPoint[];
  payingCustomers: number;
  contractedArr: number;
  atRiskArr: number;
  utilization: number;
  attentionCount: number;
  criticalCount: number;
}) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const deltaPct = mrr - mrrDelta > 0 ? (mrrDelta / (mrr - mrrDelta)) * 100 : 0;
  const deltaPositive = mrrDelta >= 0;

  return (
    <section
      className="mb-10 rounded-lg bg-canvas p-6 shadow-[var(--shadow-base)]"
      aria-label="Monthly recurring revenue and key metrics"
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-end">
        {/* Hero MRR */}
        <div>
          <div className="t-eyebrow mb-3">Monthly recurring revenue</div>
          <div className="flex items-baseline gap-4 flex-wrap">
            <span
              className="t-display-lg text-ink"
              aria-label={`MRR: ${formatUsdCompact(mrr)}`}
            >
              {formatUsdCompact(mrr)}
            </span>
            <span
              className={`font-mono text-[14px] tabular-nums ${deltaPositive ? "text-health-good" : "text-health-bad"}`}
            >
              {deltaPositive ? "+" : ""}
              {formatUsdCompact(mrrDelta)}
              <span className="text-ink-3 ml-1">
                ({deltaPositive ? "+" : ""}
                {deltaPct.toFixed(1)}%)
              </span>
            </span>
          </div>
          {mounted && mrrPoints.length > 1 && (
            <Sparkline points={mrrPoints} />
          )}
        </div>

        {/* Mini-stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <MiniStat label="Paying" value={String(payingCustomers)} />
          <MiniStat label="ARR" value={formatUsdCompact(contractedArr)} />
          <MiniStat
            label="At risk"
            value={atRiskArr > 0 ? formatUsdCompact(atRiskArr) : "$0"}
            alert={atRiskArr > 0}
          />
          <MiniStat label="Util" value={formatPct(utilization)} />
        </div>
      </div>

      {/* Attention summary chips */}
      {attentionCount > 0 && (
        <div className="mt-5 pt-4 border-t border-line flex items-center gap-2 text-[13px]">
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-health-soft-bad px-2.5 py-1 text-health-bad">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-health-bad" aria-hidden />
              <span className="font-mono tabular-nums">{criticalCount}</span> critical
            </span>
          )}
          {attentionCount - criticalCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-ink-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink-3" aria-hidden />
              <span className="font-mono tabular-nums">{attentionCount - criticalCount}</span> more
            </span>
          )}
        </div>
      )}
    </section>
  );
}

function MiniStat({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div>
      <div className="t-eyebrow mb-1">{label}</div>
      <div
        className={`font-mono tabular-nums text-[18px] leading-tight font-medium ${
          alert ? "text-health-bad" : "text-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Sparkline({ points }: { points: MrrPoint[] }) {
  const width = 200;
  const height = 32;
  const values = points.map((p) => p.mrr);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pathPoints = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  const d = `M${pathPoints.join(" L")}`;

  return (
    <svg
      width={width}
      height={height}
      className="mt-3 opacity-30"
      aria-hidden
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}
