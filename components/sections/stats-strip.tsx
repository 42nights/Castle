import { formatPct, formatUsdCompact } from "@/lib/format";

export function StatsStrip({
  payingCustomers,
  contractedArr,
  atRisk,
  templateCount,
  utilizationAvg,
}: {
  payingCustomers: number;
  contractedArr: number;
  atRisk: number;
  templateCount: number;
  utilizationAvg: number;
}) {
  const atRiskPct = contractedArr === 0 ? 0 : atRisk / contractedArr;
  return (
    <section className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
      <Stat label="Paying customers" value={String(payingCustomers)} />
      <Stat label="Contracted ARR" value={formatUsdCompact(contractedArr)} />
      <Stat
        label="At-risk ARR"
        value={atRisk > 0 ? formatUsdCompact(atRisk) : "$0"}
        sub={atRisk > 0 ? `${formatPct(atRiskPct)} of book` : "All green"}
        accent={atRisk > 0}
      />
      <Stat
        label="FDE utilization"
        value={formatPct(utilizationAvg)}
        sub={`${templateCount} template${templateCount === 1 ? "" : "s"}`}
      />
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg bg-surface border border-line px-4 py-3">
      <div className="text-[11px] tracking-wide text-ink-3 uppercase mb-1.5">
        {label}
      </div>
      <div
        className={`num text-[22px] leading-tight font-medium ${accent ? "text-accent" : "text-ink"}`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[11px] text-ink-3 leading-tight">{sub}</div>
      )}
    </div>
  );
}
