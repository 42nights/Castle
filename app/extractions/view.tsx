"use client";

import { useState, useMemo } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ExtractionsTimeline,
  type TimelineNode,
} from "@/components/extractions/extractions-timeline";
import { ExtractionsSummary } from "@/components/extractions/extractions-summary";
import type { Customer, PatternExtraction, Template } from "@/lib/types";

/** Simple timeline icon for empty state */
function TimelineIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="24" y1="8" x2="24" y2="56" />
      <circle cx="24" cy="16" r="4" />
      <circle cx="24" cy="32" r="6" />
      <circle cx="24" cy="48" r="3" />
      <line x1="28" y1="16" x2="48" y2="16" />
      <line x1="30" y1="32" x2="50" y2="32" />
      <line x1="27" y1="48" x2="44" y2="48" />
    </svg>
  );
}

export function ExtractionsView({
  extractions,
  customers,
  templates,
}: {
  extractions: PatternExtraction[];
  customers: Customer[];
  templates: Template[];
}) {
  const cById = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers],
  );
  const tById = useMemo(
    () => new Map(templates.map((t) => [t.id, t])),
    [templates],
  );

  // Filter state
  const [filterTemplate, setFilterTemplate] = useState<string>("all");
  const [filterCustomer, setFilterCustomer] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  // Unique templates/customers that appear in extractions
  const templateOptions = useMemo(() => {
    const ids = [...new Set(extractions.map((e) => e.extracted_into_template_id))];
    return ids.flatMap((id) => {
      const t = tById.get(id);
      return t ? [{ id, name: t.name }] : [];
    });
  }, [extractions, tById]);

  const customerOptions = useMemo(() => {
    const ids = [...new Set(extractions.map((e) => e.source_customer_id))];
    return ids.flatMap((id) => {
      const c = cById.get(id);
      return c ? [{ id, name: c.name }] : [];
    });
  }, [extractions, cById]);

  // Build nodes with derived data
  const allNodes: TimelineNode[] = useMemo(() => {
    return [...extractions]
      .sort((a, b) => b.extracted_at.localeCompare(a.extracted_at))
      .map((p) => ({
        extraction: p,
        source: cById.get(p.source_customer_id),
        template: tById.get(p.extracted_into_template_id),
        reused: p.reused_at_customer_ids
          .map((id) => cById.get(id))
          .filter(Boolean) as Customer[],
      }));
  }, [extractions, cById, tById]);

  // Apply filters
  const filteredNodes = useMemo(() => {
    return allNodes.filter((node) => {
      if (filterTemplate !== "all" && node.extraction.extracted_into_template_id !== filterTemplate) {
        return false;
      }
      if (filterCustomer !== "all" && node.extraction.source_customer_id !== filterCustomer) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const summary = node.extraction.source_engagement_summary.toLowerCase();
        const srcName = node.source?.name.toLowerCase() ?? "";
        const tplName = node.template?.name.toLowerCase() ?? "";
        if (!summary.includes(q) && !srcName.includes(q) && !tplName.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [allNodes, filterTemplate, filterCustomer, search]);

  const hasFilters =
    filterTemplate !== "all" || filterCustomer !== "all" || search.trim().length > 0;

  return (
    <div>
      {/* Filter row */}
      <div
        className="flex flex-wrap items-center gap-3 mb-8"
        role="group"
        aria-label="Extraction filters"
      >
        {/* Template filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="filter-template" className="t-eyebrow">
            Template
          </label>
          <select
            id="filter-template"
            value={filterTemplate}
            onChange={(e) => setFilterTemplate(e.target.value)}
            className="h-7 rounded-sm border border-line bg-canvas px-2 text-[12px] text-ink focus:outline-none focus:border-line-strong focus:shadow-[var(--shadow-focus)] transition-colors duration-instant"
          >
            <option value="all">All templates</option>
            {templateOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Customer filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="filter-customer" className="t-eyebrow">
            Customer
          </label>
          <select
            id="filter-customer"
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
            className="h-7 rounded-sm border border-line bg-canvas px-2 text-[12px] text-ink focus:outline-none focus:border-line-strong focus:shadow-[var(--shadow-focus)] transition-colors duration-instant"
          >
            <option value="all">All customers</option>
            {customerOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[160px] max-w-[280px]">
          <label htmlFor="filter-search" className="t-eyebrow">
            Search
          </label>
          <input
            id="filter-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="keyword…"
            className="flex-1 h-7 rounded-sm border border-line bg-canvas px-2 text-[12px] text-ink placeholder:text-ink-4 focus:outline-none focus:border-line-strong focus:shadow-[var(--shadow-focus)] transition-colors duration-instant"
          />
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={() => {
              setFilterTemplate("all");
              setFilterCustomer("all");
              setSearch("");
            }}
            className="text-[12px] text-ink-3 hover:text-ink transition-colors duration-instant"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Timeline or empty state */}
      {filteredNodes.length === 0 ? (
        <EmptyState
          illustration={<TimelineIcon />}
          title={
            hasFilters
              ? "No extractions match those filters."
              : "No patterns extracted yet."
          }
          description={
            hasFilters
              ? "Try clearing the filters to see the full timeline."
              : "When you turn an engagement into a template, it lands here."
          }
          action={
            hasFilters ? (
              <button
                onClick={() => {
                  setFilterTemplate("all");
                  setFilterCustomer("all");
                  setSearch("");
                }}
                className="inline-flex h-8 items-center rounded-sm bg-ink px-3 text-sm font-medium text-paper shadow-[var(--shadow-sm)] transition-colors duration-instant hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <ExtractionsTimeline nodes={filteredNodes} />
      )}

      {/* Editorial summary footer */}
      <ExtractionsSummary
        extractions={extractions}
        templates={templates}
        customers={customers}
      />
    </div>
  );
}
