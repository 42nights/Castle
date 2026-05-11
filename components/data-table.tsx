"use client";

import * as React from "react";
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
}: {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  defaultSort?: SortingState;
  filters?: FilterDef[];
  searchColumnId?: string;
  searchPlaceholder?: string;
  rowHref?: (row: TData) => string;
}) {
  const [sorting, setSorting] = React.useState<SortingState>(defaultSort ?? []);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [globalFilter, setGlobalFilter] = React.useState("");

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
                  No rows match.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                const href = rowHref?.(row.original);
                return (
                  <tr
                    key={row.id}
                    className={[
                      "border-b border-line last:border-b-0 transition-colors",
                      href ? "cursor-pointer hover:bg-surface" : "",
                    ].join(" ")}
                    onClick={
                      href
                        ? () => {
                            window.location.assign(href);
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
