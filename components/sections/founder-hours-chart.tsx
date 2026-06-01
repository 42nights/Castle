"use client";

import { useSyncExternalStore } from "react";
import {
  Area,
  CartesianGrid,
  Line,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceDot,
} from "recharts";
import type { FounderHoursPoint } from "@/lib/derive";
import { formatMonth, formatUsdCompact } from "@/lib/format";

// Sage fill — matches --color-health-good at low opacity
const SAGE_FILL = "rgba(107, 154, 107, 0.18)";
const SAGE_STROKE = "#6b9a6b";
// Amber target — matches --color-accent
const AMBER = "#c9851f";
const AMBER_FAINT = "rgba(201, 133, 31, 0.35)";
// Ink-3 grid lines
const GRID_LINE = "rgba(26, 24, 19, 0.07)";

export function FounderHoursChart({ points }: { points: FounderHoursPoint[] }) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

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

  // Latest data point that has a real `actual` value — used for the annotation
  const latestWithActual = [...chartData]
    .reverse()
    .find((d) => d.actual !== null && d.actual !== undefined);

  return (
    <section
      className="rounded-lg bg-canvas shadow-[var(--shadow-base)] overflow-hidden mb-4"
      aria-label="Founder hours per $1K ARR — leverage trend"
    >
      {/* Hidden accessible description for screen readers */}
      <p className="sr-only">
        Chart showing founder hours per $1,000 of ARR over time. Lower values
        indicate more leverage — less founder time per dollar of revenue. The
        dotted amber line shows the target trajectory: 50% reduction by Q3 2026.
      </p>

      <header className="flex items-baseline justify-between px-4 py-3 border-b border-line">
        <h2 className="t-h2 text-ink">Founder hours / $1K ARR</h2>
        <span className="t-eyebrow">
          target <span className="font-mono tabular-nums text-ink-2">−50%</span>{" "}
          by Q3 2026
        </span>
      </header>

      <div className="grid md:grid-cols-[200px_1fr] md:divide-x divide-line">
        {/* Sidebar explanation */}
        <div className="px-4 py-4 flex flex-col gap-3">
          <p className="text-ink-2 text-[13px] leading-snug">
            Lower is more leverage.
          </p>
          <p className="text-[11px] text-ink-3 leading-relaxed">
            Derived from engagement hours × founder share, divided by new ARR
            from customers starting that month.
          </p>
          <p className="text-[11px] text-ink-3 leading-relaxed">
            Target: 50% reduction by Q3 2026.
          </p>
        </div>

        {/* Chart */}
        <div className="px-4 py-4">
          <div
            className="h-[260px] w-full"
            role="img"
            aria-label="Founder leverage line chart"
          >
            {mounted && (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <ComposedChart
                  data={chartData}
                  margin={{ top: 16, right: 24, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="sageArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={SAGE_FILL} stopOpacity={1} />
                      <stop offset="100%" stopColor={SAGE_FILL} stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    stroke={GRID_LINE}
                    vertical={false}
                    strokeDasharray="0"
                  />

                  <XAxis
                    dataKey="monthLabel"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      fill: "#8a857c",
                    }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={48}
                    tick={{
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      fill: "#8a857c",
                    }}
                    tickFormatter={(v) =>
                      typeof v === "number"
                        ? v < 1
                          ? v.toFixed(2)
                          : v.toFixed(1)
                        : ""
                    }
                  />

                  <Tooltip content={<ChartTooltip />} />

                  {/* Sage area fill under actual line */}
                  <Area
                    type="monotone"
                    dataKey="actual"
                    stroke={SAGE_STROKE}
                    strokeWidth={2}
                    fill="url(#sageArea)"
                    dot={false}
                    activeDot={{ r: 4, fill: SAGE_STROKE, stroke: "#fff", strokeWidth: 2 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />

                  {/* Dotted amber target line */}
                  <Line
                    type="monotone"
                    dataKey="target"
                    stroke={AMBER_FAINT}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                  />

                  {/* Reference dot at latest extraction — annotation marker */}
                  {latestWithActual && latestWithActual.actual !== null && (
                    <ReferenceDot
                      x={latestWithActual.monthLabel}
                      y={latestWithActual.actual as number}
                      r={6}
                      fill={AMBER}
                      stroke="#fff"
                      strokeWidth={2}
                      label={{
                        value: "latest",
                        position: "top",
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        fill: AMBER,
                      }}
                    />
                  )}

                  <ReferenceLine
                    y={0}
                    stroke={GRID_LINE}
                    strokeWidth={1}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-6 t-caption">
            <span className="inline-flex items-center gap-2">
              <span
                className="inline-block h-[2px] w-5 rounded-full"
                style={{ backgroundColor: SAGE_STROKE }}
              />
              Actual h / $K ARR
            </span>
            <span className="inline-flex items-center gap-2">
              <span
                className="inline-block w-5 border-t border-dashed"
                style={{ borderColor: AMBER_FAINT }}
              />
              Target · −50% by Q3 2026
            </span>
          </div>

          {/* Chart caption */}
          <p className="mt-2 text-[11px] text-ink-3 leading-snug">
            Lower is more leverage. Target: 50% reduction by Q3 2026.
          </p>
        </div>
      </div>
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
    <div className="rounded-md border border-line bg-canvas p-3 shadow-[var(--shadow-md)]">
      <div className="t-caption mb-1">{row.monthLabel}</div>
      <div className="text-[12.5px] font-mono tabular-nums text-ink">
        {typeof actual === "number"
          ? `${actual.toFixed(2)} h / $K ARR`
          : "— no new ARR"}
      </div>
      {typeof target === "number" && (
        <div
          className="text-[11px] font-mono tabular-nums mt-0.5"
          style={{ color: AMBER }}
        >
          target {target.toFixed(2)}
        </div>
      )}
      <div className="mt-2 t-caption text-ink-3">
        <span className="font-mono tabular-nums">{row.raw.hours}h</span> founder
        ·{" "}
        <span className="font-mono tabular-nums">
          {formatUsdCompact(row.raw.arr)}
        </span>{" "}
        new ARR
      </div>
    </div>
  );
}
