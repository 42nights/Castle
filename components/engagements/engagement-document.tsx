import Link from "next/link";
import { AvatarGroup } from "@/components/atoms";
import { DeleteEngagementZone } from "@/components/controls/danger-zone";
import { EditDeploymentButton } from "@/components/controls/deployment-row-button";
import { EndDateInput } from "@/components/controls/end-date-input";
import { FdeTagsChips } from "@/components/controls/fde-tags-input";
import { HealthMenu } from "@/components/controls/health-menu";
import { NotesEditor } from "@/components/controls/notes-editor";
import { PhaseMenu } from "@/components/controls/phase-menu";
import { ProgressSlider } from "@/components/controls/progress-slider";
import { TouchedButton } from "@/components/controls/touched-button";
import { WeeklyHoursInput } from "@/components/controls/weekly-hours-input";
import {
  NewDeploymentButton,
  ReassignButton,
} from "@/components/ctas";
import { ExtractPatternButton } from "@/components/sections/extraction-cta";
import { EngagementTimeline } from "@/components/sections/engagement-timeline";
import { NotesJournal } from "@/components/sections/notes-journal";
import type { Customer, Deployment, Engagement, FDE, PatternExtraction, Template } from "@/lib/types";
import { formatDate, formatHours, formatPct } from "@/lib/format";

interface EngagementDocumentProps {
  eng: Engagement;
  customer: Customer;
  team: FDE[];
  deps: Deployment[];
  tplById: Map<string, Template>;
  relatedExtractions: PatternExtraction[];
}

/**
 * Notion-style document layout for /engagements/[slug].
 *
 * On xl+: 2-column — notes body (left, full width) + sticky status rail (right).
 * On smaller widths: status strip collapses above the notes.
 *
 * All existing mutations are preserved exactly:
 * - NotesEditor (autosave, versioning)
 * - PhaseMenu, HealthMenu, ProgressSlider
 * - WeeklyHoursInput, EndDateInput
 * - TouchedButton (u shortcut via EngagementKeys)
 * - EditDeploymentButton, NewDeploymentButton, ReassignButton
 * - ExtractPatternButton
 * - NotesJournal, EngagementTimeline (collapsed by default)
 * - DeleteEngagementZone
 */
export function EngagementDocument({
  eng,
  customer,
  team,
  deps,
  tplById,
  relatedExtractions,
}: EngagementDocumentProps) {
  return (
    <div className="space-y-6">
      {/* Notes-as-body section (xl: 2-col layout) */}
      <Panel title={null} noPadding>
        <div className="xl:grid xl:grid-cols-[1fr_240px] xl:divide-x xl:divide-line">
          {/* Notes body — primary column */}
          <div className="px-5 py-5">
            <div className="flex items-center justify-between mb-3">
              <span className="t-h2">Notes</span>
              {/* Autosave hint */}
              <span className="t-caption text-ink-3">Autosaves on idle · versioned</span>
            </div>
            <NotesEditor
              engagementSlug={eng.id}
              initialBody={eng.notes}
              initialVersion={1}
            />
          </div>

          {/* Sticky status rail — secondary column */}
          <aside
            className="xl:sticky xl:top-16 xl:self-start px-5 py-5 border-t border-line xl:border-t-0 space-y-5"
            aria-label="Engagement status"
          >
            <div>
              <div className="t-meta text-ink-3 mb-1.5">Phase</div>
              <PhaseMenu engagementSlug={eng.id} current={eng.phase} />
            </div>

            <div>
              <div className="t-meta text-ink-3 mb-1.5">Progress</div>
              <ProgressSlider engagementSlug={eng.id} current={eng.progress_pct} />
            </div>

            <div>
              <div className="t-meta text-ink-3 mb-1.5">Health</div>
              <HealthMenu engagementSlug={eng.id} current={eng.health} />
            </div>

            <div>
              <div className="t-meta text-ink-3 mb-1.5">Team</div>
              <div className="flex flex-col gap-1.5">
                <AvatarGroup names={team.map((f) => f.name)} />
                {team.some((f) => f.tags.length > 0) && (
                  <div className="flex flex-col gap-0.5 text-[11.5px]">
                    {team
                      .filter((f) => f.tags.length > 0)
                      .map((f) => (
                        <div key={f.id} className="inline-flex items-center gap-1.5 text-ink-3">
                          <span className="text-ink-2">{f.name}</span>
                          <FdeTagsChips tags={f.tags} max={4} size="xs" />
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="t-meta text-ink-3 mb-1.5">Hours / wk</div>
              <span className="text-[13px] text-ink inline-flex items-baseline gap-0.5">
                <WeeklyHoursInput engagementSlug={eng.id} current={eng.weekly_hours} />
                <span className="text-ink-3">/wk committed</span>
              </span>
            </div>

            <div>
              <div className="t-meta text-ink-3 mb-1.5">Dates</div>
              <div className="text-[12px] text-ink-2 space-y-1">
                <div>
                  Started <span className="num text-ink">{formatDate(eng.start_date)}</span>
                </div>
                <div className="inline-flex items-baseline gap-1">
                  Ends{" "}
                  <EndDateInput engagementSlug={eng.id} current={eng.expected_end_date} />
                </div>
              </div>
            </div>

            <div>
              <div className="t-meta text-ink-3 mb-1.5">Activity</div>
              <div className="flex items-center gap-2">
                <TouchedButton engagementSlug={eng.id} />
                <span className="t-caption text-ink-3">
                  press{" "}
                  <kbd className="rounded-xs border border-line bg-surface-1 px-1 num text-[10px]">u</kbd>
                </span>
              </div>
            </div>
          </aside>
        </div>
      </Panel>

      {/* Deployments */}
      <Panel
        title="Deployments"
        count={deps.length}
        right={
          <div className="flex items-center gap-2">
            <ReassignButton engagementSlug={eng.id} />
            <NewDeploymentButton engagementId={eng.id} customerId={customer.id} />
          </div>
        }
        noPadding
      >
        {deps.length === 0 ? (
          <p className="px-5 py-4 text-ink-3 text-[13px]">None deployed yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-line text-ink-3 uppercase tracking-[0.06em] text-[10px]">
                <th className="text-left h-9 px-5 font-medium">Agent</th>
                <th className="text-left h-9 px-3 font-medium hidden md:table-cell">Template</th>
                <th className="text-right h-9 px-3 font-medium hidden md:table-cell">Custom %</th>
                <th className="text-right h-9 px-3 font-medium">Hrs/wk</th>
                <th className="text-right h-9 px-3 font-medium hidden sm:table-cell">Deployed</th>
                <th className="h-9 px-3" />
              </tr>
            </thead>
            <tbody>
              {deps.map((d) => {
                const tpl = d.template_id ? tplById.get(d.template_id) : null;
                return (
                  <tr key={d.id} className="border-b border-line last:border-b-0 hover:bg-surface-1 transition-colors duration-instant">
                    <td className="px-5 py-3.5 text-ink text-[13.5px]">{d.agent_name}</td>
                    <td className="px-3 py-3.5 text-ink-2 text-[13px] hidden md:table-cell">
                      {tpl ? (
                        <Link href={`/templates/${tpl.id}`} className="hover:underline underline-offset-2 decoration-line">
                          {tpl.name}
                        </Link>
                      ) : (
                        <span className="text-ink-3">— custom</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 num text-right text-ink-2 text-[12.5px] hidden md:table-cell">
                      {formatPct(d.customization_pct / 100)}
                    </td>
                    <td className="px-3 py-3.5 num text-right text-ink-2 text-[12.5px]">
                      {formatHours(d.hours_replaced_per_week)}
                    </td>
                    <td className="px-3 py-3.5 num text-right text-ink-3 text-[12px] hidden sm:table-cell">
                      {formatDate(d.deployed_at)}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <EditDeploymentButton
                        deploymentId={d.id}
                        initial={{
                          agent_name: d.agent_name,
                          template_id: d.template_id,
                          hours_replaced_per_week: d.hours_replaced_per_week,
                          customization_pct: d.customization_pct,
                          deployed_at: d.deployed_at,
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      {/* Patterns extracted */}
      <Panel
        title="Patterns extracted"
        count={relatedExtractions.length}
        right={<ExtractPatternButton sourceEngagementSlug={eng.id} />}
        noPadding
      >
        {relatedExtractions.length === 0 ? (
          <p className="px-5 py-4 text-ink-3 text-[13px]">
            Nothing extracted yet. Capture a pattern with{" "}
            <span className="t-mono">+ Extract pattern</span>.
          </p>
        ) : (
          <ul>
            {relatedExtractions.map((p) => {
              const tpl = tplById.get(p.extracted_into_template_id);
              return (
                <li key={p.id} className="px-5 py-3.5 border-b border-line last:border-b-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link
                      href={`/templates/${tpl?.id ?? ""}`}
                      className="text-ink text-[13.5px] hover:underline underline-offset-2 decoration-line"
                    >
                      {tpl?.name ?? "—"}
                    </Link>
                    <span className="t-caption">
                      reused at{" "}
                      <span className="num text-ink-2">{p.reused_at_customer_ids.length}</span>{" "}
                      customer{p.reused_at_customer_ids.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-ink-2 text-[12.5px] leading-snug">{p.source_engagement_summary}</p>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* Versioned history — collapsed by default */}
      <CollapsiblePanel title="Versioned history" defaultOpen={false}>
        <div className="px-5 py-4">
          <NotesJournal engagementSlug={eng.id} />
        </div>
      </CollapsiblePanel>

      {/* Touch log — collapsed by default */}
      <CollapsiblePanel title="Touch log" defaultOpen={false}>
        <div className="px-5 py-4">
          <EngagementTimeline engagementSlug={eng.id} />
        </div>
      </CollapsiblePanel>

      {/* Danger zone */}
      <DangerZoneWrapper>
        <DeleteEngagementZone engagementSlug={eng.id} customerName={customer.name} />
      </DangerZoneWrapper>
    </div>
  );
}

/* ── Local primitives ────────────────────────────────────────────── */

function Panel({
  title,
  count,
  right,
  children,
  noPadding = false,
}: {
  title: string | null;
  count?: number;
  right?: React.ReactNode;
  children: React.ReactNode;
  noPadding?: boolean;
}) {
  return (
    <section className="rounded-md bg-canvas border border-line shadow-[var(--shadow-base)] overflow-hidden">
      {title !== null && (
        <header className="flex items-baseline justify-between gap-4 px-5 py-3.5 border-b border-line">
          <div className="flex items-baseline gap-2">
            <h2 className="t-h2">{title}</h2>
            {typeof count === "number" && (
              <span className="num text-[12px] text-ink-3">{count}</span>
            )}
          </div>
          {right}
        </header>
      )}
      <div className={noPadding ? "" : "px-5 py-4"}>{children}</div>
    </section>
  );
}

function CollapsiblePanel({
  title,
  children,
  defaultOpen,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen: boolean;
}) {
  // Server component trick: initial state comes from prop;
  // client interactivity handled via details/summary
  return (
    <details open={defaultOpen} className="rounded-md bg-canvas border border-line shadow-[var(--shadow-base)] overflow-hidden group">
      <summary className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-line cursor-pointer list-none select-none hover:bg-surface-1 transition-colors duration-instant">
        <div className="flex items-baseline gap-2">
          <h2 className="t-h2">{title}</h2>
        </div>
        <svg
          className="w-4 h-4 text-ink-3 transition-transform duration-quick group-open:rotate-180 shrink-0"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      {children}
    </details>
  );
}

function DangerZoneWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-health-bad/30 bg-health-soft-bad/20 overflow-hidden">
      {children}
    </div>
  );
}

// Need React for JSX in this server component file
import * as React from "react";
