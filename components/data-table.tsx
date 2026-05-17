"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

type FilterDef = {
  id: string;
  label: string;
  options: { label: string; value: string }[];
};

export function DataTable<TData, TValue>({
  columns,
  data,
  defaultSort,
  filters = [],
  searchColumnId,
  searchPlaceholder = "Search…",
  rowHref,
  urlKey,
  emptyContent,
}: {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  defaultSort?: SortingState;
  filters?: FilterDef[];
  searchColumnId?: string;
  searchPlaceholder?: string;
  rowHref?: (row: TData) => string;
  /** Namespace for URL search params (e.g. "eng", "cust"). When set,
   *  filter + search state is mirrored to / hydrated from search params. */
  urlKey?: string;
  /** Rendered in the empty-row cell when there are no rows at all (not
   *  just a no-filter-match). Useful for surfacing a + CTA. */
  emptyContent?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const paramFor = React.useCallback(
    (k: string) => (urlKey ? `${urlKey}.${k}` : k),
    [urlKey],
  );

  const initialFilters: ColumnFiltersState = React.useMemo(() => {
    if (!urlKey) return [];
    return filters
      .map((f) => {
        const v = searchParams.get(paramFor(f.id));
        return v ? { id: f.id, value: v } : null;
      })
      .filter(Boolean) as ColumnFiltersState;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialQuery = urlKey ? (searchParams.get(paramFor("q")) ?? "") : "";

  const [sorting, setSorting] = React.useState<SortingState>(defaultSort ?? []);
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>(initialFilters);
  const [globalFilter, setGlobalFilter] = React.useState(initialQuery);

  // Mirror filter state → URL.
  React.useEffect(() => {
    if (!urlKey) return;
    const next = new URLSearchParams(searchParams.toString());
    for (const f of filters) {
      next.delete(paramFor(f.id));
    }
    for (const cf of columnFilters) {
      if (cf.value) next.set(paramFor(cf.id), String(cf.value));
    }
    if (globalFilter) next.set(paramFor("q"), globalFilter);
    else next.delete(paramFor("q"));
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnFilters, globalFilter, urlKey]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: searchColumnId
      ? (row, _columnId, value) => {
          const v = row.getValue<unknown>(searchColumnId);
          return String(v ?? "").toLowerCase().includes(String(value).toLowerCase());
        }
      : "includesString",
  });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {searchColumnId && (
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 w-60 rounded-sm border border-line bg-page px-2.5 text-[13px] placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-ink"
          />
        )}
        {filters.map((f) => {
          const col = table.getColumn(f.id);
          const value = (col?.getFilterValue() as string) ?? "";
          return (
            <select
              key={f.id}
              value={value}
              onChange={(e) =>
                col?.setFilterValue(e.target.value || undefined)
              }
              className="h-8 rounded-sm border border-line bg-page px-2 text-[13px] text-ink-2 focus:outline-none focus:ring-1 focus:ring-ink"
            >
              <option value="">{f.label}</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          );
        })}
        <div className="ml-auto t-caption">
          {table.getFilteredRowModel().rows.length} rows
        </div>
      </div>

      <div className="border-t border-b border-line">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-line">
                {hg.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      className={[
                        "h-9 px-3 text-left align-middle text-ink-3 uppercase tracking-[0.06em] text-[10px] font-medium",
                        canSort ? "cursor-pointer select-none hover:text-ink" : "",
                      ].join(" ")}
                      onClick={
                        canSort
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {sorted === "asc" && <span>↑</span>}
                        {sorted === "desc" && <span>↓</span>}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-14 text-center text-ink-3 text-sm"
                >
                  {data.length === 0 && emptyContent
                    ? emptyContent
                    : "No rows match."}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                const href = rowHref?.(row.original);
                return (
                  <tr
                    key={row.id}
                    role={href ? "link" : undefined}
                    tabIndex={href ? 0 : undefined}
                    className={[
                      "border-b border-line last:border-b-0 transition-colors outline-none focus-visible:bg-surface",
                      href ? "cursor-pointer hover:bg-surface" : "",
                    ].join(" ")}
                    onMouseEnter={
                      href
                        ? () => {
                            // Warm the destination's static shell (its
                            // `loading.tsx`) so the click feels instant.
                            router.prefetch(href);
                          }
                        : undefined
                    }
                    onClick={href ? () => router.push(href) : undefined}
                    onKeyDown={
                      href
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              router.push(href);
                            }
                          }
                        : undefined
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-3 py-3 align-middle text-[13.5px]"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
