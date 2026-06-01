"use client";

/**
 * ExtractionsTimeline — vertical timeline for /extractions.
 *
 * Each extraction is a node with:
 *   - Date marker (JetBrains Mono, left rail)
 *   - Connecting line
 *   - Node dot SIZED BY reuse count (small dot = single use, large amber = 5+)
 *   - Node body card: source engagement summary, customer link,
 *     template link, reuse count
 *
 * Filtering by template/customer is done upstream in view.tsx — this
 * component receives the already-filtered list.
 *
 * Node click navigates to the template page (§8.14 cut: drawer is cut-if-slipping).
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Customer, PatternExtraction, Template } from "@/lib/types";
import { formatDate } from "@/lib/format";

type TimelineNode = {
  extraction: PatternExtraction;
  source: Customer | undefined;
  template: Template | undefined;
  reused: Customer[];
};

function nodeSize(reuseCount: number): {
  outerClass: string;
  innerClass: string;
  size: string;
} {
  if (reuseCount >= 5) {
    return {
      outerClass: "bg-accent/20 border-2 border-accent",
      innerClass: "bg-accent",
      size: "h-4 w-4",
    };
  }
  if (reuseCount >= 2) {
    return {
      outerClass: "bg-accent-soft border-2 border-accent/40",
      innerClass: "bg-accent/70",
      size: "h-3 w-3",
    };
  }
  return {
    outerClass: "bg-surface-2 border border-line-strong",
    innerClass: "bg-ink-4",
    size: "h-2 w-2",
  };
}

export function ExtractionsTimeline({
  nodes,
}: {
  nodes: TimelineNode[];
}) {
  const router = useRouter();

  if (nodes.length === 0) {
    return null;
  }

  return (
    <ol
      className="relative"
      aria-label="Pattern extractions timeline"
    >
      {nodes.map((node, i) => {
        const { extraction: p, source, template, reused } = node;
        const reuseCount = reused.length;
        const dot = nodeSize(reuseCount);
        const isLast = i === nodes.length - 1;

        return (
          <li key={p.id} className="flex gap-6 group">
            {/* Left rail: date + connecting line */}
            <div className="flex flex-col items-center">
              {/* Date */}
              <span className="font-mono tabular-nums text-[11px] text-ink-3 whitespace-nowrap pt-1 w-[72px] text-right">
                {formatDate(p.extracted_at)}
              </span>
              {/* Line segment */}
              {!isLast && (
                <div className="flex-1 w-px bg-line mt-1 mb-0 min-h-[32px]" aria-hidden />
              )}
            </div>

            {/* Node dot */}
            <div className="flex flex-col items-center pt-1">
              <button
                className={`rounded-full flex items-center justify-center flex-shrink-0 transition-transform duration-quick hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${dot.size} ${dot.outerClass}`}
                onClick={() => {
                  if (template) router.push(`/templates/${template.id}`);
                }}
                aria-label={`Extraction: ${source?.name ?? "Unknown"} → ${template?.name ?? "removed"}. ${reuseCount} reuse${reuseCount === 1 ? "" : "s"}.`}
                title={
                  template
                    ? `View template: ${template.name}`
                    : "Template removed"
                }
              >
                <span className={`rounded-full ${dot.innerClass} h-1 w-1`} aria-hidden />
              </button>
              {/* Connector to next node */}
              {!isLast && (
                <div className="flex-1 w-px bg-line mt-1 min-h-[32px]" aria-hidden />
              )}
            </div>

            {/* Node body card */}
            <div className={`flex-1 pb-6 ${isLast ? "pb-2" : ""}`}>
              <div className="rounded-lg bg-canvas shadow-[var(--shadow-base)] p-4 hover:shadow-[var(--shadow-md)] hover:-translate-y-px transition-all duration-base">
                {/* Engagement summary */}
                {p.source_engagement_summary && (
                  <p className="text-[14px] text-ink leading-relaxed mb-3">
                    {p.source_engagement_summary}
                  </p>
                )}

                {/* Links row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
                    {source && (
                      <span className="flex items-center gap-1.5 text-ink-3">
                        <span className="t-eyebrow">Source</span>
                        <Link
                          href={`/customers/${source.id}`}
                          className="text-ink-2 hover:text-ink hover:underline underline-offset-2 decoration-line/40 transition-colors duration-instant"
                        >
                          {source.name}
                        </Link>
                      </span>
                    )}
                    {template && (
                      <span className="flex items-center gap-1.5 text-ink-3">
                        <span className="t-eyebrow">Template</span>
                        <Link
                          href={`/templates/${template.id}`}
                          className="text-ink-2 hover:text-ink hover:underline underline-offset-2 decoration-line/40 transition-colors duration-instant"
                        >
                          {template.name}
                        </Link>
                      </span>
                    )}
                  </div>

                  {/* Reuse count */}
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-mono tabular-nums shrink-0 ${
                      reuseCount >= 5
                        ? "bg-accent-soft text-accent-ink"
                        : reuseCount >= 2
                          ? "bg-surface-2 text-ink-2"
                          : "bg-surface-1 text-ink-3"
                    }`}
                    aria-label={`Reused ${reuseCount} time${reuseCount === 1 ? "" : "s"}`}
                  >
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${
                        reuseCount >= 5
                          ? "bg-accent"
                          : reuseCount >= 2
                            ? "bg-ink-3"
                            : "bg-ink-4"
                      }`}
                      aria-hidden
                    />
                    {reuseCount} {reuseCount === 1 ? "reuse" : "reuses"}
                  </span>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export type { TimelineNode };
