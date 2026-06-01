import Link from "next/link";
import { CapacityInput } from "@/components/controls/capacity-input";
import { FdeTagsChips } from "@/components/controls/fde-tags-input";
import { LogHoursButton } from "@/components/controls/log-hours-button";
import type { FdeWorkload } from "@/lib/derive";
import { formatHours, formatPct } from "@/lib/format";

export function FdeWorkloadBoard({
  workloads,
  weeklyShipsByFde,
  imbalance,
}: {
  workloads: FdeWorkload[];
  weeklyShipsByFde: Record<string, number>;
  imbalance: number;
}) {
  return (
    <section
      className="rounded-lg bg-canvas shadow-[var(--shadow-base)] overflow-hidden"
      aria-label="FDE workload board"
    >
      <header className="flex items-baseline justify-between px-4 py-3 border-b border-line">
        <h2 className="t-h2">Bench</h2>
        <span className="text-[11px] text-ink-3">
          load spread{" "}
          <span className="font-mono tabular-nums text-ink-2">
            {imbalance.toFixed(2)}
          </span>
        </span>
      </header>

      <ol>
        {workloads.map((w, i) => (
          <FdeRow
            key={w.fde.id}
            workload={w}
            shippedLast7d={weeklyShipsByFde[w.fde.id] ?? 0}
            border={i > 0}
          />
        ))}
      </ol>
    </section>
  );
}

function FdeRow({
  workload: w,
  shippedLast7d,
  border,
}: {
  workload: FdeWorkload;
  shippedLast7d: number;
  border: boolean;
}) {
  const util = w.utilization;
  const utilLabel =
    w.status === "overcommitted"
      ? "over"
      : w.status === "at capacity"
        ? "full"
        : w.status === "healthy"
          ? "ok"
          : "free";
  const utilTone =
    w.status === "overcommitted"
      ? "text-health-bad"
      : w.status === "at capacity"
        ? "text-health-warn"
        : "text-ink-3";

  return (
    <li
      className={`px-4 py-3 hover:bg-surface-1 transition-colors duration-instant ${
        border ? "border-t border-line" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <Link
            href={`/fdes/${w.fde.id}`}
            className="text-[13.5px] font-medium text-ink hover:underline underline-offset-2 decoration-line/40 truncate"
          >
            {w.fde.name}
          </Link>
          <span className="text-[12px] text-ink-3 shrink-0">{w.fde.role}</span>
        </div>
        <span
          className={`font-mono tabular-nums text-[12px] ${utilTone}`}
          aria-label={`Utilization: ${formatPct(util)}, ${utilLabel}`}
        >
          {formatPct(util)} {utilLabel}
        </span>
      </div>

      <CapacityBar utilization={util} status={w.status} />

      <div className="mt-2 flex items-baseline gap-2 flex-wrap text-[12px] text-ink-3">
        <span>
          <span className="font-mono tabular-nums text-ink-2">
            {w.committedHours.toFixed(0)}h
          </span>{" "}
          /
          <CapacityInput fdeSlug={w.fde.id} current={w.capacityHours} />
        </span>
        <span className="text-line-strong">|</span>
        <span>
          actual{" "}
          <span className="font-mono tabular-nums text-ink-2">
            {formatHours(w.actualHours)}
          </span>
          <LogHoursButton fdeSlug={w.fde.id} />
        </span>
        <span className="text-line-strong">|</span>
        <span>
          <span className="font-mono tabular-nums">{w.activeEngagements.length}</span>{" "}
          active
        </span>
        <span className="text-line-strong">|</span>
        <span>
          <span className="font-mono tabular-nums">{shippedLast7d}</span> shipped
        </span>
      </div>

      {w.fde.tags.length > 0 && (
        <div className="mt-2">
          <FdeTagsChips tags={w.fde.tags} max={4} size="xs" />
        </div>
      )}
    </li>
  );
}

function CapacityBar({
  utilization,
  status,
}: {
  utilization: number;
  status: FdeWorkload["status"];
}) {
  const VISUAL_MAX = 1.4;
  const width = Math.min(100, (utilization / VISUAL_MAX) * 100);
  const capLine = (1 / VISUAL_MAX) * 100;
  const fill =
    status === "overcommitted"
      ? "bg-health-bad"
      : status === "at capacity"
        ? "bg-health-warn"
        : "bg-health-good";
  return (
    <div
      className="relative h-1.5 rounded-full bg-surface-2 overflow-hidden"
      aria-hidden
    >
      <span
        className={`absolute inset-y-0 left-0 rounded-full ${fill} transition-all duration-slow`}
        style={{ width: `${width}%` }}
      />
      <span
        className="absolute inset-y-0 w-px bg-ink-4"
        style={{ left: `${capLine}%` }}
      />
    </div>
  );
}
