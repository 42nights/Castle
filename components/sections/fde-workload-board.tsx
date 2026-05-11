import Link from "next/link";
import { Avatar, HealthPip } from "@/components/atoms";
import type {
  FdeWorkload,
  FdeWorkloadStatus,
} from "@/lib/derive";
import { formatHours } from "@/lib/format";

const statusTone: Record<
  FdeWorkloadStatus,
  { label: string; chip: string; bar: string }
> = {
  available: {
    label: "Available",
    chip: "bg-page border border-line text-ink-2",
    bar: "bg-ink",
  },
  healthy: {
    label: "Healthy",
    chip: "bg-page border border-line text-ink",
    bar: "bg-ink",
  },
  "at capacity": {
    label: "At capacity",
    chip: "bg-ink text-page",
    bar: "bg-ink",
  },
  overcommitted: {
    label: "Overcommitted",
    chip: "bg-accent text-page",
    bar: "bg-accent",
  },
};

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
    <section className="mb-14">
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="t-eyebrow mb-2">— FDE workload</div>
          <h2 className="t-h2 text-ink">Who&rsquo;s carrying what.</h2>
        </div>
        <div className="t-caption text-ink-3">
          load imbalance σ ={" "}
          <span className="num text-ink-2">{imbalance.toFixed(2)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {workloads.map((w) => (
          <FdeCard
            key={w.fde.id}
            workload={w}
            shippedLast7d={weeklyShipsByFde[w.fde.id] ?? 0}
          />
        ))}
      </div>
    </section>
  );
}

function FdeCard({
  workload,
  shippedLast7d,
}: {
  workload: FdeWorkload;
  shippedLast7d: number;
}) {
  const tone = statusTone[workload.status];
  const utilDisplay = Math.min(150, Math.round(workload.utilization * 100));
  const barWidth = Math.min(100, (workload.utilization / 1.5) * 100);
  return (
    <Link
      href={`/fdes/${workload.fde.id}`}
      className="block border border-line rounded-md p-5 bg-page hover:bg-surface transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={workload.fde.name} size={40} />
          <div className="min-w-0">
            <div className="t-h3 truncate">{workload.fde.name}</div>
            <div className="t-caption text-ink-3">
              {workload.fde.role}
              {workload.fde.is_founder && " · co-founder"}
            </div>
          </div>
        </div>
        <span
          className={`t-caption inline-flex h-5 items-center rounded-sm px-2 uppercase tracking-[0.08em] ${tone.chip}`}
        >
          {tone.label}
        </span>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between t-caption">
          <span>Capacity</span>
          <span>
            <span className="num text-ink">
              {workload.committedHours.toFixed(0)}
            </span>{" "}
            / <span className="num">{workload.capacityHours}</span> h committed ·{" "}
            <span className="num text-ink">{utilDisplay}%</span>
          </span>
        </div>
        <div className="mt-2 relative h-1.5 rounded-sm bg-surface overflow-hidden">
          <span
            className="absolute inset-y-0 left-0 right-0 border-r border-dashed border-line"
            style={{ width: `${(1 / 1.5) * 100}%` }}
          />
          <span
            className={`absolute inset-y-0 left-0 ${tone.bar}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <div className="mt-1 t-caption text-ink-3 flex justify-between">
          <span>
            Actual{" "}
            <span className="num text-ink-2">
              {formatHours(workload.actualHours)}
            </span>{" "}
            / wk
          </span>
          <span>
            Gap{" "}
            <span className="num text-ink-2">
              {(workload.committedHours - workload.actualHours).toFixed(0)}h
            </span>
          </span>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-line grid grid-cols-3 gap-3">
        <StatTiny
          label="Active eng"
          value={String(workload.activeEngagements.length)}
        />
        <StatTiny label="Shipped 7d" value={String(shippedLast7d)} />
        <StatTiny
          label="Avg health"
          value={
            <HealthPip value={workload.avgPortfolioHealth} />
          }
        />
      </div>

      <ul className="mt-4 space-y-1 t-caption">
        {workload.activeEngagements.slice(0, 4).map((e) => (
          <li
            key={e.id}
            className="flex items-center gap-2 text-ink-2"
            title={e.notes}
          >
            <HealthPip value={e.health} />
            <span className="truncate flex-1">{e.notes.split(".")[0]}.</span>
            <span className="num text-ink-3">
              {(e.weekly_hours / Math.max(1, e.fde_ids.length)).toFixed(0)}h
            </span>
          </li>
        ))}
        {workload.activeEngagements.length > 4 && (
          <li className="t-caption text-ink-3">
            + {workload.activeEngagements.length - 4} more
          </li>
        )}
      </ul>
    </Link>
  );
}

function StatTiny({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="t-caption">{label}</div>
      <div className="mt-1 text-ink num text-[15px]">{value}</div>
    </div>
  );
}

