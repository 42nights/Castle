"use client";

import { useState, useSyncExternalStore } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LogFounderMonthDialog } from "@/components/dialogs/log-founder-month-dialog";
import type { FounderHoursPoint } from "@/lib/derive";
import { formatMonth, formatUsdCompact } from "@/lib/format";

export function FounderHoursChart({ points }: { points: FounderHoursPoint[] }) {
  // Recharts measures parent dimensions on mount; in SSR they're -1.
  // useSyncExternalStore with constant snapshots is the canonical "have we
  // hydrated yet" check that lints cleanly.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [editing, setEditing] = useState<{
    month: string;
    hours: number;
    arr: number;
  } | null>(null);
  const chartData = points.map((p) => ({
    month: p.month,
    monthLabel: formatMonth(p.month),
    actual: p.hoursPerArrK,
    target: p.target,
    raw: {
      hours: p.founder_hours_total,
      arr: p.new_arr_dollars,
    },
  }));

  return (
    <section className="mb-14">
      <div className="grid md:grid-cols-[280px_1fr] gap-10">
        <div>
          <div className="t-eyebrow mb-3">— Founder leverage</div>
          <h2 className="t-h2 text-ink mb-3">
            Founder hours per <span className="t-mono text-[20px]">$1K</span>{" "}
            of new ARR.
          </h2>
          <p className="text-ink-2 text-[14px] leading-relaxed">
            The one chart that matters to investors. Each month: how many founder
            hours did it take to bring on a dollar of new ARR? Lower is more
            leverage. Target: <span className="text-ink">−50%</span> by Q3 2026.
          </p>
          <button
            onClick={() => {
              const month = new Date().toISOString().slice(0, 7);
              const existing = points.find((p) => p.month === month);
              setEditing({
                month,
                hours: existing?.founder_hours_total ?? 0,
                arr: existing?.new_arr_dollars ?? 0,
              });
            }}
            className="mt-4 h-7 px-3 rounded-sm border border-line bg-page text-ink hover:bg-surface text-[12px]"
          >
            + Log this month
          </button>
        </div>

        <div className="border border-line rounded-md p-5 bg-page">
          <div className="h-[320px] w-full">
            {mounted && (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 24, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke="rgba(10,10,10,0.08)" vertical={false} />
                <XAxis
                  dataKey="monthLabel"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) =>
                    typeof v === "number"
                      ? v < 1
                        ? v.toFixed(2)
                        : v.toFixed(1)
                      : ""
                  }
                />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#888888"
                  strokeWidth={1}
                  strokeDasharray="3 4"
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#0A0A0A"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#0A0A0A" }}
                  activeDot={{ r: 5, fill: "#D72638" }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <ReferenceLine
                  y={0}
                  stroke="rgba(10,10,10,0.16)"
                  strokeWidth={1}
                />
              </LineChart>
            </ResponsiveContainer>
            )}
          </div>
          <div className="mt-4 flex items-center gap-6 t-caption">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-[2px] w-5 bg-ink" />
              Actual h / $K ARR
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-px w-5 border-t border-dashed border-ink-3" />
              Target trendline · −50% by Q3 2026
            </span>
          </div>
        </div>
      </div>

      <LogFounderMonthDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        initialMonth={editing?.month}
        initialHours={editing?.hours}
        initialArr={editing?.arr}
      />
    </section>
  );
}

interface TooltipPayload {
  name?: string;
  value?: number;
  payload?: {
    monthLabel?: string;
    raw?: { hours: number; arr: number };
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
  if (!row?.raw) return null;
  const actual = payload.find((p) => p.name === "actual")?.value;
  const target = payload.find((p) => p.name === "target")?.value;
  return (
    <div className="rounded-sm border border-line bg-page p-3 shadow-sm">
      <div className="t-caption mb-1">{row.monthLabel}</div>
      <div className="text-[12.5px] num text-ink">
        {typeof actual === "number"
          ? `${actual.toFixed(2)} h / $K ARR`
          : "— no new ARR"}
      </div>
      {typeof target === "number" && (
        <div className="text-[11px] num text-ink-3">
          target {target.toFixed(2)}
        </div>
      )}
      <div className="mt-2 t-caption text-ink-3">
        <span className="num">{row.raw.hours}h</span> founder ·{" "}
        <span className="num">{formatUsdCompact(row.raw.arr)}</span> new ARR
      </div>
    </div>
  );
}
