"use client";

import { useSyncExternalStore } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MrrPoint } from "@/lib/derive";
import { formatUsdCompact } from "@/lib/format";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Format a "YYYY-MM-DD" bucket without crossing into local time.
 * `formatDate()` parses via `new Date(iso)` and renders in local tz,
 * which slides 2026-05-11 to "May 10" in any negative-offset zone.
 */
function formatDayLocal(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}`;
}

/**
 * Daily MRR chart. Replaces the old founder-hours/$1K-ARR panel.
 * Shows total monthly recurring revenue across active customers,
 * sampled per day for the configured window.
 */
export function MrrChart({ points }: { points: MrrPoint[] }) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const chartData = points.map((p) => ({
    day: p.day,
    label: formatDayLocal(p.day),
    mrr: p.mrr,
    count: p.customerCount,
  }));

  const latest = chartData.at(-1);
  const earliest = chartData[0];
  const delta =
    latest && earliest ? latest.mrr - earliest.mrr : 0;
  const deltaPct =
    earliest && earliest.mrr > 0
      ? ((delta / earliest.mrr) * 100)
      : null;

  return (
    <section className="panel mb-4">
      <header className="panel-header">
        <h2 className="t-h2 text-ink">MRR</h2>
        <span className="text-[11px] text-ink-3">
          last <span className="num text-ink-2">{points.length}</span> days
        </span>
      </header>
      <div className="grid md:grid-cols-[200px_1fr] md:divide-x divide-line">
        <div className="px-3 py-3">
          <div className="num text-ink text-[22px] leading-[28px]">
            {latest ? formatUsdCompact(latest.mrr) : "—"}
          </div>
          <div className="t-caption text-ink-3 mt-0.5">today · MRR</div>
          <div className="mt-3 text-[12px] text-ink-2">
            {delta >= 0 ? "+" : "−"}
            <span className="num">{formatUsdCompact(Math.abs(delta))}</span>
            {deltaPct !== null && (
              <span className="text-ink-3">
                {" "}({deltaPct >= 0 ? "+" : ""}
                <span className="num">{deltaPct.toFixed(1)}%</span>)
              </span>
            )}
            <div className="t-caption text-ink-3 mt-0.5">
              vs {earliest ? formatDayLocal(earliest.day) : "—"}
            </div>
          </div>
          <p className="mt-3 text-[11px] text-ink-3 leading-snug">
            Sum of <span className="num">current_mrr</span> across active
            customers as of each day. Churned customers are excluded retroactively
            (we don&apos;t track churn dates).
          </p>
        </div>

        <div className="px-3 py-3">
          <div className="h-[260px] w-full">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 24, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#ffffff"
                        stopOpacity={0.18}
                      />
                      <stop
                        offset="100%"
                        stopColor="#ffffff"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="rgba(255,255,255,0.12)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                    minTickGap={32}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={56}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      typeof v === "number" ? formatUsdCompact(v) : ""
                    }
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="mrr"
                    stroke="#ffffff"
                    strokeWidth={2}
                    fill="url(#mrrFill)"
                    isAnimationActive={false}
                    activeDot={{ r: 4, fill: "#ff3b47" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

interface TooltipPayload {
  value?: number;
  payload?: {
    label?: string;
    count?: number;
    mrr?: number;
  };
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-sm border border-line bg-page p-3 shadow-sm">
      <div className="t-caption mb-1">{row.label}</div>
      <div className="text-[13px] num text-ink">
        {typeof row.mrr === "number" ? formatUsdCompact(row.mrr) : "—"}
      </div>
      {typeof row.count === "number" && (
        <div className="mt-1 t-caption text-ink-3">
          <span className="num">{row.count}</span> active customers
        </div>
      )}
    </div>
  );
}
