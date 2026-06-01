"use client";

// TemplateGrid — rebuilt with Paper design system per §5.3.
// Staggered card entrance (30ms per card, 8px translateY, fade).
// Filters: category chips + sort + text search, all client-state.
// Respects prefers-reduced-motion by skipping animation transforms.

import { useMemo, useState, useSyncExternalStore } from "react";
import { TemplateCard } from "@/components/templates/template-card";
import { TemplateFilters, type FilterState, type SortKey } from "@/components/templates/template-filters";
import { EmptyState } from "@/components/ui/empty-state";
import type { TemplateUsage } from "@/lib/derive";
import type { Customer, FDE } from "@/lib/types";

// Minimal grid SVG for empty state
function LibraryIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="6" y="10" width="10" height="28" rx="2" />
      <rect x="19" y="6" width="10" height="32" rx="2" />
      <rect x="32" y="14" width="10" height="24" rx="2" />
    </svg>
  );
}

function sortUsage(list: TemplateUsage[], sort: SortKey): TemplateUsage[] {
  const copy = [...list];
  copy.sort((a, b) => {
    if (sort === "alpha") return a.template.name.localeCompare(b.template.name);
    if (sort === "newest") return b.template.created_at.localeCompare(a.template.created_at);
    if (sort === "oldest") return a.template.created_at.localeCompare(b.template.created_at);
    // "reused" — by deploymentCount desc, then newest
    if (b.deploymentCount !== a.deploymentCount) return b.deploymentCount - a.deploymentCount;
    return b.template.created_at.localeCompare(a.template.created_at);
  });
  return copy;
}

function matchesSearch(u: TemplateUsage, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  if (u.template.name.toLowerCase().includes(lower)) return true;
  if (u.template.capabilities.some((c) => c.toLowerCase().includes(lower))) return true;
  if (u.template.tags.some((t) => t.toLowerCase().includes(lower))) return true;
  return false;
}

export function TemplateGrid({
  usage,
  customers,
  fdes,
}: {
  usage: TemplateUsage[];
  customers: Customer[];
  fdes: FDE[];
}) {
  const cById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const fById = useMemo(() => new Map(fdes.map((f) => [f.id, f])), [fdes]);

  const [filters, setFilters] = useState<FilterState>({
    category: "all",
    sort: "reused",
    search: "",
  });
  // `mounted` is false on the server / first render, true on the client.
  // Pattern from components/sections/hero-metrics.tsx.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Read prefers-reduced-motion only after mount (no SSR window).
  const reducedMotion = useMemo(
    () => mounted && typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
    [mounted],
  );

  const filtered = useMemo(() => {
    let list = usage.filter(
      (u) => !u.template.archived_at &&
        (filters.category === "all" || u.template.category === filters.category) &&
        matchesSearch(u, filters.search)
    );
    list = sortUsage(list, filters.sort);
    return list;
  }, [usage, filters]);

  // Tag click — filter by that tag
  const handleTagClick = (tag: string) => {
    setFilters((prev) => ({ ...prev, search: `#${tag}` === prev.search ? "" : tag }));
  };

  const isEmpty = filtered.length === 0;
  const hasActiveFilters = filters.category !== "all" || filters.search !== "";

  return (
    <>
      <TemplateFilters value={filters} onChange={setFilters} />

      {isEmpty ? (
        <EmptyState
          illustration={<LibraryIcon />}
          title={hasActiveFilters ? "No templates match." : "No templates yet."}
          description={
            hasActiveFilters
              ? "Clear the filters or search a different term."
              : "When you extract a pattern from an engagement, it lands here."
          }
          action={
            hasActiveFilters ? (
              <button
                type="button"
                onClick={() => setFilters({ category: "all", sort: "reused", search: "" })}
                className="inline-flex h-8 items-center rounded-sm border border-line bg-canvas px-3 text-sm text-ink shadow-[var(--shadow-xs)] hover:bg-surface-1 transition-colors duration-instant focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
              >
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          role="list"
          aria-label="Templates"
        >
          {filtered.map((u, i) => (
            <div key={u.template.id} role="listitem">
              <TemplateCard
                usage={u}
                customers={cById}
                fdes={fById}
                onTagClick={handleTagClick}
                style={
                  mounted && !reducedMotion
                    ? {
                        animation: `fadeSlideUp 300ms both`,
                        animationDelay: `${i * 30}ms`,
                      }
                    : undefined
                }
              />
            </div>
          ))}
        </div>
      )}

      {/* Card entrance keyframes — scoped to this component's output */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes fadeSlideUp {
            from { opacity: 1; transform: none; }
            to   { opacity: 1; transform: none; }
          }
        }
      `}</style>
    </>
  );
}
