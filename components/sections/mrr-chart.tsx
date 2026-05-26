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

function formatDayLocal(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}`;
}

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
  const delta = latest && earliest ? latest.mrr - earliest.mrr : 0;
  const deltaPct =
    earliest && earliest.mrr > 0 ? (delta / earliest.mrr) * 100 : null;

  return (
    <section className="rounded-lg bg-surface border border-line overflow-hidden">
      <header className="flex items-baseline justify-between px-4 py-3 border-b border-line">
        <h2 className="t-h2">MRR trend</h2>
        <span className="text-[11px] text-ink-3">
          <span className="num text-ink-2">{points.length}</span> days
        </span>
      </header>
      <div className="grid md:grid-cols-[180px_1fr] md:divide-x divide-line">
        <div className="px-4 py-4">
          <div className="num text-ink text-[20px] leading-tight font-medium">
            {latest ? formatUsdCompact(latest.mrr) : "..."}
          </div>
          <div className="text-[11px] text-ink-3 mt-1">today</div>
          <div className="mt-3 text-[12px] text-ink-2">
            {delta >= 0 ? "+" : ""}
            <span className="num">{formatUsdCompact(Math.abs(delta))}</span>
            {deltaPct !== null && (
              <span className="text-ink-3 ml-1">
                ({deltaPct >= 0 ? "+" : ""}
                <span className="num">{deltaPct.toFixed(1)}%</span>)
              </span>
            )}
          </div>
          <div className="text-[11px] text-ink-3 mt-0.5">
            vs {earliest ? formatDayLocal(earliest.day) : "..."}
          </div>
        </div>

        <div className="px-4 py-4">
          <div className="h-[220px] w-full">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fafafa" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="#fafafa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="rgba(250,250,250,0.06)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11 }}
                    minTickGap={36}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={52}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      typeof v === "number" ? formatUsdCompact(v) : ""
                    }
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="mrr"
                    stroke="#fafafa"
                    strokeWidth={1.5}
                    fill="url(#mrrFill)"
                    isAnimationActive={false}
                    activeDot={{ r: 3, fill: "#ff3b47" }}
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
    <div className="rounded-md border border-line bg-surface p-2.5 shadow-lg">
      <div className="text-[11px] text-ink-3 mb-0.5">{row.label}</div>
      <div className="text-[13px] num text-ink font-medium">
        {typeof row.mrr === "number" ? formatUsdCompact(row.mrr) : "..."}
      </div>
      {typeof row.count === "number" && (
        <div className="mt-0.5 text-[11px] text-ink-3">
          <span className="num">{row.count}</span> customers
        </div>
      )}
    </div>
  );
}
