import { formatPct, formatUsdCompact } from "@/lib/format";

/**
 * Four stats. Not five.
 *
 * Dropped "Hours / wk replaced" — downstream of deployments, already
 * surfaced on the FDE workload board. Including it doubles the count
 * without adding a new operator question.
 *
 * No surrounding card. No top hairline tying the four together. The
 * numbers ARE the section — they sit directly on the page next to
 * Today, separated only by whitespace.
 *
 * At-risk ARR is the only one that uses the accent, and only when
 * non-zero. The accent says "look here," used once per surface.
 */
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
    <section className="panel mb-4 grid grid-cols-2 md:grid-cols-4 divide-x divide-line">
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
    <div className="px-3 py-3">
      <div className="text-[10px] tracking-[0.06em] text-ink-3 uppercase mb-1">
        {label}
      </div>
      <div
        className={[
          "num text-[24px] leading-[28px] font-medium",
          accent ? "text-accent" : "text-ink",
        ].join(" ")}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[11px] text-ink-3 leading-tight">{sub}</div>
      )}
    </div>
  );
}
