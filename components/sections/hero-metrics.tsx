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
    <section className="mb-8">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-end">
        <div>
          <div className="t-eyebrow mb-3">Monthly recurring revenue</div>
          <div className="flex items-baseline gap-4">
            <span className="num text-[40px] leading-none font-medium tracking-tight text-ink">
              {formatUsdCompact(mrr)}
            </span>
            <span
              className={`num text-[14px] ${deltaPositive ? "text-ok" : "text-accent"}`}
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

      {attentionCount > 0 && (
        <div className="mt-4 flex items-center gap-2 text-[13px]">
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-accent">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="num">{criticalCount}</span> critical
            </span>
          )}
          {attentionCount - criticalCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-ink-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink-3" />
              <span className="num">{attentionCount - criticalCount}</span> more
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
      <div className="text-[11px] text-ink-3 uppercase tracking-wide mb-0.5">
        {label}
      </div>
      <div className={`num text-[18px] leading-tight font-medium ${alert ? "text-accent" : "text-ink"}`}>
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
      className="mt-2 opacity-40"
      aria-hidden
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}
