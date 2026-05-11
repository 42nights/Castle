import { formatHours, formatPct, formatUsdCompact } from "@/lib/format";

export function StatsStrip({
  payingCustomers,
  contractedArr,
  atRisk,
  templateCount,
  hoursReplaced,
  utilizationAvg,
}: {
  payingCustomers: number;
  contractedArr: number;
  atRisk: number;
  templateCount: number;
  hoursReplaced: number;
  utilizationAvg: number;
}) {
  const atRiskPct = contractedArr === 0 ? 0 : atRisk / contractedArr;
  return (
    <section className="grid grid-cols-2 md:grid-cols-5 gap-x-10 gap-y-6 mb-14">
      <Stat label="Paying customers" value={payingCustomers} />
      <Stat
        label="Contracted ARR"
        value={formatUsdCompact(contractedArr)}
        sub={`${payingCustomers} active contracts`}
      />
      <Stat
        label="At-risk ARR"
        value={formatUsdCompact(atRisk)}
        sub={
          atRisk === 0
            ? "All green"
            : `${formatPct(atRiskPct)} of book · yellow + red`
        }
        accent={atRisk > 0}
      />
      <Stat
        label="Agent templates"
        value={templateCount}
        sub="In library"
      />
      <Stat
        label="Hours / wk replaced"
        value={formatHours(hoursReplaced)}
        sub={`FDE util avg ${formatPct(utilizationAvg)}`}
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
    <div className="border-t border-line pt-4">
      <div className="t-caption mb-2">{label}</div>
      <div
        className={[
          "t-display text-[40px] leading-[40px]",
          accent ? "text-accent" : "text-ink",
        ].join(" ")}
      >
        {value}
      </div>
      {sub && <div className="mt-2 text-ink-2 text-[12.5px]">{sub}</div>}
    </div>
  );
}
