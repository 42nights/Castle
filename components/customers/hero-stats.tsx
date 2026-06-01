import { MrrInput } from "@/components/controls/mrr-input";
import type { Customer, Deployment } from "@/lib/types";
import { formatUsd, formatHours } from "@/lib/format";

interface CustomerHeroStatsProps {
  customer: Customer;
  deployments: Deployment[];
}

/**
 * Hero metric strip for /customers/[slug].
 * MRR is the inline-editable field with dotted-underline affordance.
 * ARR, live agents, and hrs/wk replaced are read-only derived values.
 */
export function CustomerHeroStats({ customer, deployments }: CustomerHeroStatsProps) {
  const totalHours = deployments.reduce((s, d) => s + d.hours_replaced_per_week, 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 border border-line rounded-md bg-canvas shadow-[var(--shadow-base)] mb-6 overflow-hidden">
      {/* MRR — hero, inline-editable */}
      <div className="px-5 py-4 border-r border-line">
        <div className="t-meta text-ink-3 mb-2">MRR</div>
        <div className="text-[28px] font-semibold leading-[1.1] tracking-tight text-ink num">
          <MrrInput customerSlug={customer.id} current={customer.current_mrr} />
        </div>
        <div className="mt-1 text-[11px] text-ink-3">
          hover to edit
        </div>
      </div>

      {/* ARR */}
      <div className="px-5 py-4 border-r border-line">
        <div className="t-meta text-ink-3 mb-2">ARR run-rate</div>
        <div className="text-[22px] font-semibold leading-[1.1] tracking-tight text-ink num">
          {formatUsd(customer.current_mrr * 12)}
        </div>
      </div>

      {/* Live agents */}
      <div className="px-5 py-4 border-r border-line">
        <div className="t-meta text-ink-3 mb-2">Live agents</div>
        <div className="text-[22px] font-semibold leading-[1.1] tracking-tight text-ink num">
          {deployments.length}
        </div>
      </div>

      {/* Hours replaced/wk */}
      <div className="px-5 py-4">
        <div className="t-meta text-ink-3 mb-2">Hrs replaced / wk</div>
        <div className="text-[22px] font-semibold leading-[1.1] tracking-tight text-ink num">
          {totalHours === 0 ? "—" : formatHours(totalHours)}
        </div>
      </div>
    </div>
  );
}
