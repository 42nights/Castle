"use client";

import * as React from "react";
import Link from "next/link";
import { AvatarGroup, HealthPip, ProgressBar } from "@/components/atoms";
import { HealthMenu } from "@/components/controls/health-menu";
import { PhaseMenu } from "@/components/controls/phase-menu";
import { TouchedButton } from "@/components/controls/touched-button";
import type { EngagementRow } from "@/lib/derive";
import { engagementsByPhase } from "@/lib/derive";
import type { EngagementPhase } from "@/lib/types";
import { formatDate, formatHours } from "@/lib/format";
import { cn } from "@/lib/utils";

const PHASE_LABELS: Record<EngagementPhase, string> = {
  discovery: "Discovery",
  build: "Build",
  deployed: "Live",
  support: "Wind-down",
};

const PHASE_COLORS: Record<EngagementPhase, string> = {
  discovery: "text-[#C9851F]",        // honey amber
  build: "text-[#6B9A6B]",            // sage
  deployed: "text-[#5B8DB8]",         // calm blue
  support: "text-[#8A857C]",          // ink-3 dusty
};

const PHASE_ORDER: EngagementPhase[] = ["discovery", "build", "deployed", "support"];

interface PhaseGroupedTableProps {
  rows: EngagementRow[];
  viewMode: "grouped" | "flat";
}

/**
 * Phase-grouped engagement list.
 *
 * Sections: Discovery·N / Build·N / Live·N / Wind-down·N
 * Inside each section: a sub-table sorted red-top.
 * Red health rows show a soft left-border accent.
 *
 * Drag-drop between phases is cut. Phase change available via inline PhaseMenu.
 */
export function PhaseGroupedTable({ rows, viewMode }: PhaseGroupedTableProps) {
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.customer.name.toLowerCase().includes(q) ||
        r.engagement.notes.toLowerCase().includes(q),
    );
  }, [rows, search]);

  if (viewMode === "flat") {
    return (
      <div>
        <SearchBar value={search} onChange={setSearch} count={filtered.length} />
        <FlatTable rows={filtered} />
      </div>
    );
  }

  const grouped = engagementsByPhase(filtered);

  return (
    <div>
      <SearchBar value={search} onChange={setSearch} count={filtered.length} />
      {PHASE_ORDER.map((phase) => {
        const phaseRows = grouped[phase];
        if (phaseRows.length === 0) return null;
        return (
          <PhaseSection
            key={phase}
            phase={phase}
            rows={phaseRows}
          />
        );
      })}
      {filtered.length === 0 && (
        <p className="py-12 text-center text-ink-3 text-sm">
          {rows.length === 0 ? "No engagements yet." : "No engagements match."}
        </p>
      )}
    </div>
  );
}

function SearchBar({
  value,
  onChange,
  count,
}: {
  value: string;
  onChange: (v: string) => void;
  count: number;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by customer or notes…"
        aria-label="Search engagements"
        className="h-8 w-64 rounded-sm border border-line bg-canvas px-2.5 text-[13px] placeholder:text-ink-3 focus:outline-none focus-visible:shadow-[var(--shadow-focus)] transition-shadow duration-quick"
      />
      <span className="ml-auto t-caption">{count} engagements</span>
    </div>
  );
}

function PhaseSection({
  phase,
  rows,
}: {
  phase: EngagementPhase;
  rows: EngagementRow[];
}) {
  return (
    <section className="mb-8" aria-label={`${PHASE_LABELS[phase]} engagements`}>
      {/* Phase eyebrow header */}
      <div className="flex items-baseline gap-2 mb-3">
        <h2
          className={cn(
            "text-[11px] font-medium uppercase tracking-[0.08em]",
            PHASE_COLORS[phase],
          )}
        >
          {PHASE_LABELS[phase]}
        </h2>
        <span className="num text-[11px] text-ink-3">{rows.length}</span>
      </div>

      <div className="border-t border-b border-line">
        <table className="w-full">
          <thead>
            <tr className="border-b border-line">
              <th className="h-9 px-3 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3">
                Customer
              </th>
              <th className="h-9 px-3 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3 hidden md:table-cell">
                Progress
              </th>
              <th className="h-9 px-3 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3 hidden lg:table-cell">
                Team
              </th>
              <th className="h-9 px-3 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3 hidden lg:table-cell">
                End date
              </th>
              <th className="h-9 px-3 text-right text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3 hidden md:table-cell">
                Hrs / wk
              </th>
              <th className="h-9 px-3 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3">
                Health
              </th>
              <th className="h-9 px-3 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3">
                Phase
              </th>
              <th className="h-9 px-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <EngagementRowItem key={r.engagement.id} row={r} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FlatTable({ rows }: { rows: EngagementRow[] }) {
  return (
    <div className="border-t border-b border-line">
      <table className="w-full">
        <thead>
          <tr className="border-b border-line">
            <th className="h-9 px-3 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3">Customer</th>
            <th className="h-9 px-3 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3 hidden md:table-cell">Progress</th>
            <th className="h-9 px-3 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3 hidden lg:table-cell">Team</th>
            <th className="h-9 px-3 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3 hidden lg:table-cell">End date</th>
            <th className="h-9 px-3 text-right text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3 hidden md:table-cell">Hrs / wk</th>
            <th className="h-9 px-3 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3">Health</th>
            <th className="h-9 px-3 text-left text-[10px] font-medium uppercase tracking-[0.06em] text-ink-3">Phase</th>
            <th className="h-9 px-3" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-12 text-center text-ink-3 text-sm">
                No engagements match.
              </td>
            </tr>
          ) : (
            rows.map((r) => <EngagementRowItem key={r.engagement.id} row={r} />)
          )}
        </tbody>
      </table>
    </div>
  );
}

function EngagementRowItem({ row }: { row: EngagementRow }) {
  const isRed = row.engagement.health === "red";
  return (
    <tr
      className={cn(
        "border-b border-line last:border-b-0 transition-colors duration-instant group",
        isRed
          ? "bg-health-soft-bad/20 hover:bg-health-soft-bad/30"
          : "hover:bg-surface-1",
      )}
    >
      {/* Red health: left border accent */}
      {isRed && (
        <td className="absolute left-0 top-0 bottom-0 w-0.5 bg-health-bad" aria-hidden />
      )}

      {/* Customer name → link to engagement */}
      <td className="px-3 py-3.5 align-middle">
        <div className="flex items-center gap-2">
          {isRed && <HealthPip value="red" />}
          <Link
            href={`/engagements/${row.engagement.id}`}
            className="text-[14px] text-ink font-medium hover:underline underline-offset-2 decoration-line min-w-0 truncate"
          >
            {row.customer.name}
          </Link>
        </div>
      </td>

      {/* Progress bar */}
      <td className="px-3 py-3.5 align-middle hidden md:table-cell">
        <div className="flex items-center gap-2 w-28">
          <ProgressBar value={row.engagement.progress_pct} className="flex-1" />
          <span className="num text-ink-3 text-[12px] w-7 text-right shrink-0">
            {row.engagement.progress_pct}%
          </span>
        </div>
      </td>

      {/* Team avatars */}
      <td className="px-3 py-3.5 align-middle hidden lg:table-cell">
        <AvatarGroup names={row.fdes.map((f) => f.name)} />
      </td>

      {/* End date */}
      <td className="px-3 py-3.5 align-middle num text-ink-3 text-[12.5px] hidden lg:table-cell">
        {formatDate(row.engagement.expected_end_date)}
      </td>

      {/* Weekly hours */}
      <td className="px-3 py-3.5 align-middle num text-ink-2 text-[13px] text-right hidden md:table-cell">
        {formatHours(row.engagement.weekly_hours)}
      </td>

      {/* Health menu */}
      <td className="px-3 py-3.5 align-middle">
        <HealthMenu
          engagementSlug={row.engagement.id}
          current={row.engagement.health}
        />
      </td>

      {/* Phase menu */}
      <td className="px-3 py-3.5 align-middle">
        <PhaseMenu
          engagementSlug={row.engagement.id}
          current={row.engagement.phase}
        />
      </td>

      {/* Touch button */}
      <td className="px-3 py-3.5 align-middle text-right">
        <TouchedButton engagementSlug={row.engagement.id} />
      </td>
    </tr>
  );
}
