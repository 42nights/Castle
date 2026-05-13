import Link from "next/link";
import { CapacityInput } from "@/components/controls/capacity-input";
import { LogHoursButton } from "@/components/controls/log-hours-button";
import type { FdeWorkload } from "@/lib/derive";
import { formatHours, formatPct } from "@/lib/format";

/**
 * FDE workload.
 *
 * Each FDE = one row, not a card. The whole row is a sentence:
 *
 *   Jerry X · Founder · overcommitted
 *   50h committed against 45h cap (111%). Actual 38h. 2 active.
 *   3 shipped this wk. Portfolio ·
 *
 * No cards. Hairlines between rows. Capacity + log-hours stay inline
 * (frequent ops); everything else lives on /fdes/[slug].
 */
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
    <section className="panel mb-4">
      <header className="panel-header">
        <h2 className="t-h2 text-ink">Bench</h2>
        <span className="text-[11px] text-ink-3">
          load σ ={" "}
          <span className="num text-ink-2">{imbalance.toFixed(2)}</span>
        </span>
      </header>

      <ol className="ledger">
        {workloads.map((w) => (
          <FdeRow
            key={w.fde.id}
            workload={w}
            shippedLast7d={weeklyShipsByFde[w.fde.id] ?? 0}
          />
        ))}
      </ol>
    </section>
  );
}

function FdeRow({
  workload: w,
  shippedLast7d,
}: {
  workload: FdeWorkload;
  shippedLast7d: number;
}) {
  const util = w.utilization;
  const utilLabel =
    w.status === "overcommitted"
      ? "overcommitted"
      : w.status === "at capacity"
        ? "at capacity"
        : w.status === "healthy"
          ? "healthy"
          : "available";
  const utilTone =
    w.status === "overcommitted" ? "text-accent" : "text-ink-2";
  const portfolioPip =
    w.avgPortfolioHealth === "—" ? undefined : w.avgPortfolioHealth;

  return (
    <li className="px-3 py-2.5 grid grid-cols-[1fr_auto] gap-6 items-baseline">
      <div className="min-w-0">
        <div className="flex items-baseline gap-3 flex-wrap">
          <Link
            href={`/fdes/${w.fde.id}`}
            className="t-h3 text-ink hover:underline"
          >
            {w.fde.name}
          </Link>
          <span className="text-[13px] text-ink-3">
            {w.fde.role}
            {w.fde.is_founder && " · co-founder"}
          </span>
          <span className={`text-[13px] ${utilTone}`}>{utilLabel}</span>
        </div>

        <p className="mt-2 text-[14px] text-ink-2 leading-relaxed">
          <span className="num text-ink">
            {w.committedHours.toFixed(0)}h
          </span>{" "}
          committed against{" "}
          <CapacityInput
            fdeSlug={w.fde.id}
            current={w.capacityHours}
          />{" "}
          cap (
          <span className={`num ${utilTone}`}>{formatPct(util)}</span>
          ).{" "}
          <span className="text-ink-3">
            Actual{" "}
            <span className="num">{formatHours(w.actualHours)}</span>
            <LogHoursButton fdeSlug={w.fde.id} />
            {" · "}
            <span className="num">{w.activeEngagements.length}</span> active
            {" · "}
            <span className="num">{shippedLast7d}</span> shipped this wk
            {portfolioPip && (
              <>
                {" · "}portfolio{" "}
                <span
                  className="hp inline-block translate-y-[-1px]"
                  data-health={portfolioPip}
                />
              </>
            )}
          </span>
        </p>
      </div>

      <div className="w-32 self-center">
        <CapacityBar utilization={util} status={w.status} />
      </div>
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
  const VISUAL_MAX = 1.5;
  const width = Math.min(100, (utilization / VISUAL_MAX) * 100);
  const capLine = (1 / VISUAL_MAX) * 100;
  const fill = status === "overcommitted" ? "bg-accent" : "bg-ink";
  return (
    <div
      className="relative h-[3px] bg-line rounded-full overflow-hidden"
      aria-hidden
    >
      <span
        className={`absolute inset-y-0 left-0 ${fill}`}
        style={{ width: `${width}%` }}
      />
      <span
        className="absolute inset-y-0 w-px bg-ink-3"
        style={{ left: `${capLine}%` }}
      />
    </div>
  );
}
