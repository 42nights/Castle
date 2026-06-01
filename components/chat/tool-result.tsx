"use client";

// U4 — tool-result renderer dispatcher + shared renderers.
// Registered renderers:
//   list_customers        → ToolResultTable (sortable)
//   list_attention        → ToolResultCards (severity sorted)
//   list_engagements      → ToolResultKanban (by phase)
//   list_fdes             → ToolResultTable
//   list_templates        → ToolResultTable
//   list_deployments      → ToolResultTable
//   engagement_mark_touched, attention_snooze, attention_resolve → ToolResultChips
//   UNKNOWN               → JsonFallback

import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  getRenderer,
  normalizeToolName,
  registerRenderer,
  type RendererCtx,
} from "@/lib/tool-renderers";
import type { ToolActivity } from "@/lib/use-hermes-chat";

// ─── helpers ──────────────────────────────────────────────────────────────────

function extractArray(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object") {
    // Common envelope patterns: { customers: [...] }, { items: [...] }, etc.
    for (const key of ["customers", "items", "data", "results", "rows", "engagements", "fdes", "templates", "deployments", "attention_items"]) {
      const val = (result as Record<string, unknown>)[key];
      if (Array.isArray(val)) return val;
    }
    // Last resort: first array value
    for (const val of Object.values(result as Record<string, unknown>)) {
      if (Array.isArray(val)) return val;
    }
  }
  return [];
}

function safeStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

const COLLAPSE_LS_PREFIX = "castle_tool_collapse_";

function useCollapsed(key: string, turnsAgo: number): [boolean, () => void] {
  const lsKey = COLLAPSE_LS_PREFIX + key;
  const [collapsed, setCollapsed] = useState(() => {
    if (turnsAgo >= 10) return true;
    try {
      return localStorage.getItem(lsKey) === "1";
    } catch {
      return false;
    }
  });
  const toggle = () => {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(lsKey, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };
  return [collapsed, toggle];
}

// ─── CollapseWrapper ──────────────────────────────────────────────────────────

function CollapseWrapper({
  label,
  count,
  collapsed,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-sm border border-line bg-surface overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-[11.5px] text-ink-2 hover:bg-surface-hover transition-colors"
        aria-expanded={!collapsed}
      >
        <span className="flex items-center gap-2">
          <span className="text-ink-3">{collapsed ? "▸" : "▾"}</span>
          <span className="font-medium">{label}</span>
          <span className="text-ink-3 num">{count}</span>
        </span>
        <span className="text-ink-3 text-[10px] uppercase tracking-wider">
          {collapsed ? "expand" : "collapse"}
        </span>
      </button>
      {!collapsed && children}
    </div>
  );
}

// ─── ToolResultTable ─────────────────────────────────────────────────────────

type TableCol = { header: string; key: string; cell?: (v: unknown, row: Record<string, unknown>) => React.ReactNode };

function ToolResultTable({
  rows,
  cols,
  label,
  ctx,
  collapseKey,
}: {
  rows: Record<string, unknown>[];
  cols: TableCol[];
  label: string;
  ctx: RendererCtx;
  collapseKey: string;
}) {
  const [collapsed, onToggle] = useCollapsed(collapseKey, ctx.turnsAgo);
  const [sorting, setSorting] = useState<SortingState>([]);

  type Row = Record<string, unknown>;
  const ch = createColumnHelper<Row>();
  const columns = useMemo(
    () =>
      cols.map((c) =>
        ch.accessor((row) => row[c.key], {
          id: c.key,
          header: c.header,
          cell: (info) => {
            const val = info.getValue();
            if (c.cell) return c.cell(val, info.row.original as Record<string, unknown>);
            return <span className="text-ink">{safeStr(val)}</span>;
          },
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const table = useReactTable<Row>({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <CollapseWrapper label={label} count={rows.length} collapsed={collapsed} onToggle={onToggle}>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-t border-line">
                {hg.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className="px-3 py-1.5 text-left text-[10px] uppercase tracking-wider text-ink-3 cursor-pointer select-none hover:text-ink"
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === "asc" && "↑"}
                        {sorted === "desc" && "↓"}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-line hover:bg-surface-hover">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CollapseWrapper>
  );
}

// ─── HealthPill ───────────────────────────────────────────────────────────────

function HealthPill({ health }: { health: unknown }) {
  const h = safeStr(health);
  const colors: Record<string, string> = {
    green: "bg-ok/15 text-ok",
    yellow: "bg-warn/15 text-warn",
    red: "bg-accent/15 text-accent",
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-medium ${colors[h] ?? "bg-surface text-ink-3"}`}>
      {h || "—"}
    </span>
  );
}

function StatusPill({ status }: { status: unknown }) {
  const s = safeStr(status);
  const colors: Record<string, string> = {
    active: "bg-ok/15 text-ok",
    churned: "bg-accent/15 text-accent",
    paused: "bg-warn/15 text-warn",
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] ${colors[s] ?? "bg-surface text-ink-3"}`}>
      {s || "—"}
    </span>
  );
}

function MrrCell({ value }: { value: unknown }) {
  const n = typeof value === "number" ? value : parseFloat(safeStr(value));
  if (isNaN(n)) return <span className="text-ink-3">—</span>;
  return <span className="num text-ink">${n.toLocaleString()}</span>;
}

// ─── ToolResultCards (severity cards) ────────────────────────────────────────

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2 };
const SEVERITY_COLORS: Record<string, { dot: string; border: string; label: string }> = {
  critical: { dot: "bg-accent", border: "border-accent/30", label: "text-accent" },
  high: { dot: "bg-warn", border: "border-warn/30", label: "text-warn" },
  medium: { dot: "bg-ink-3", border: "border-line", label: "text-ink-3" },
};

function ToolResultCards({
  items,
  label,
  ctx,
  collapseKey,
}: {
  items: Record<string, unknown>[];
  label: string;
  ctx: RendererCtx;
  collapseKey: string;
}) {
  const [collapsed, onToggle] = useCollapsed(collapseKey, ctx.turnsAgo);

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        const sa = SEVERITY_ORDER[safeStr(a.severity)] ?? 99;
        const sb = SEVERITY_ORDER[safeStr(b.severity)] ?? 99;
        return sa - sb;
      }),
    [items],
  );

  return (
    <CollapseWrapper label={label} count={items.length} collapsed={collapsed} onToggle={onToggle}>
      <div className="divide-y divide-line">
        {sorted.map((item, i) => {
          const sev = safeStr(item.severity);
          const style = SEVERITY_COLORS[sev] ?? SEVERITY_COLORS.medium;
          const href = typeof item.href === "string" && item.href ? item.href : null;
          const inner = (
            <>
              <span className={`mt-1 inline-block size-1.5 rounded-full shrink-0 ${style.dot}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase tracking-wider font-medium ${style.label}`}>{sev}</span>
                </div>
                <p className="text-[12.5px] text-ink leading-snug mt-0.5">
                  {safeStr(item.title || item.name || item.message || JSON.stringify(item))}
                </p>
                {(item.subtitle != null || item.description != null) && (
                  <p className="text-[11.5px] text-ink-3 leading-snug mt-0.5">
                    {safeStr(item.subtitle ?? item.description)}
                  </p>
                )}
              </div>
            </>
          );
          const base = `flex items-start gap-3 px-3 py-2.5 border-l-2 ${style.border}`;
          return href ? (
            <Link
              key={i}
              href={href}
              className={`${base} group/card hover:bg-surface-1 transition-colors duration-[var(--duration-instant)] outline-none focus-visible:bg-surface-1`}
            >
              {inner}
              <ChevronRight className="ml-auto self-center size-3.5 text-ink-3 opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0" />
            </Link>
          ) : (
            <div key={i} className={base}>{inner}</div>
          );
        })}
      </div>
    </CollapseWrapper>
  );
}

// ─── ToolResultKanban ─────────────────────────────────────────────────────────

const PHASE_ORDER = ["discovery", "build", "deployed", "support"];

function ToolResultKanban({
  items,
  label,
  ctx,
  collapseKey,
}: {
  items: Record<string, unknown>[];
  label: string;
  ctx: RendererCtx;
  collapseKey: string;
}) {
  const [collapsed, onToggle] = useCollapsed(collapseKey, ctx.turnsAgo);

  const groups = useMemo(() => {
    const g = new Map<string, Record<string, unknown>[]>();
    for (const item of items) {
      const phase = safeStr(item.phase || item.status || item.stage || "unknown");
      if (!g.has(phase)) g.set(phase, []);
      g.get(phase)!.push(item);
    }
    return g;
  }, [items]);

  const phases = useMemo(() => {
    const keys = [...groups.keys()];
    return [...PHASE_ORDER.filter((p) => keys.includes(p)), ...keys.filter((k) => !PHASE_ORDER.includes(k))];
  }, [groups]);

  return (
    <CollapseWrapper label={label} count={items.length} collapsed={collapsed} onToggle={onToggle}>
      <div className="flex gap-0 overflow-x-auto divide-x divide-line">
        {phases.map((phase) => {
          const phaseItems = groups.get(phase) ?? [];
          return (
            <div key={phase} className="flex-1 min-w-[140px] p-2">
              <div className="text-[10px] uppercase tracking-wider text-ink-3 mb-2 px-1">
                {phase} <span className="num">{phaseItems.length}</span>
              </div>
              <div className="flex flex-col gap-1">
                {phaseItems.map((item, i) => (
                  <div key={i} className="rounded-sm border border-line bg-page px-2 py-1.5">
                    <p className="text-[11.5px] text-ink leading-snug truncate">
                      {safeStr(item.name || item.title || item.customer_name || JSON.stringify(item))}
                    </p>
                    {item.health != null && <HealthPill health={item.health} />}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </CollapseWrapper>
  );
}

// ─── ToolResultChips (mutation confirmations) ─────────────────────────────────

function ToolResultChips({ result, label }: { result: unknown; label: string }) {
  const message = (() => {
    if (typeof result === "string") return result;
    if (result && typeof result === "object") {
      const r = result as Record<string, unknown>;
      return safeStr(r.message ?? r.result ?? r.status ?? "");
    }
    return "";
  })();

  return (
    <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-sm border border-[var(--color-ribbon-done)]/30 bg-[var(--color-ribbon-done)]/10 text-[11.5px] text-ok">
      <span aria-hidden>✓</span>
      {message ? `${label}: ${message}` : label}
    </span>
  );
}

// ─── JsonFallback ──────────────────────────────────────────────────────────────

function JsonFallback({ result, ctx, collapseKey }: { result: unknown; ctx: RendererCtx; collapseKey: string }) {
  const [collapsed, onToggle] = useCollapsed(collapseKey, ctx.turnsAgo);
  const json = useMemo(() => {
    try { return JSON.stringify(result, null, 2); } catch { return String(result); }
  }, [result]);

  return (
    <CollapseWrapper label="Result" count={0} collapsed={collapsed} onToggle={onToggle}>
      <pre className="px-3 py-2 text-[11px] text-ink-2 leading-relaxed overflow-x-auto max-h-60">
        {json}
      </pre>
    </CollapseWrapper>
  );
}

// ─── Register all renderers ───────────────────────────────────────────────────

// Customers: sortable table with name, MRR, health pill, status
registerRenderer("list_customers", (result, ctx) => {
  const rows = extractArray(result) as Record<string, unknown>[];
  if (rows.length === 0) return null;
  const cols: TableCol[] = [
    { header: "Customer", key: "name" },
    { header: "MRR", key: "current_mrr", cell: (v) => <MrrCell value={v} /> },
    { header: "Health", key: "health", cell: (v) => <HealthPill health={v} /> },
    { header: "Status", key: "status", cell: (v) => <StatusPill status={v} /> },
  ];
  return (
    <ToolResultTable
      rows={rows}
      cols={cols}
      label="Customers"
      ctx={ctx}
      collapseKey={`list_customers_${ctx.turnsAgo}`}
    />
  );
});

// Attention: severity cards
registerRenderer("list_attention", (result, ctx) => {
  const items = extractArray(result) as Record<string, unknown>[];
  if (items.length === 0) return null;
  return (
    <ToolResultCards
      items={items}
      label="Attention items"
      ctx={ctx}
      collapseKey={`list_attention_${ctx.turnsAgo}`}
    />
  );
});

// Engagements: kanban by phase
registerRenderer("list_engagements", (result, ctx) => {
  const items = extractArray(result) as Record<string, unknown>[];
  if (items.length === 0) return null;
  return (
    <ToolResultKanban
      items={items}
      label="Engagements"
      ctx={ctx}
      collapseKey={`list_engagements_${ctx.turnsAgo}`}
    />
  );
});

// FDEs: table
registerRenderer("list_fdes", (result, ctx) => {
  const rows = extractArray(result) as Record<string, unknown>[];
  if (rows.length === 0) return null;
  const cols: TableCol[] = [
    { header: "Name", key: "name" },
    { header: "Role", key: "role" },
    { header: "Hrs/wk", key: "hours_this_week", cell: (v) => <span className="num text-ink">{safeStr(v)}</span> },
    { header: "Capacity", key: "capacity_hours_per_week", cell: (v) => <span className="num text-ink-3">{safeStr(v)}</span> },
  ];
  return (
    <ToolResultTable
      rows={rows}
      cols={cols}
      label="FDEs"
      ctx={ctx}
      collapseKey={`list_fdes_${ctx.turnsAgo}`}
    />
  );
});

// Templates: table
registerRenderer("list_templates", (result, ctx) => {
  const rows = extractArray(result) as Record<string, unknown>[];
  if (rows.length === 0) return null;
  const cols: TableCol[] = [
    { header: "Name", key: "name" },
    { header: "Category", key: "category" },
    { header: "Origin", key: "origin_customer_name" },
  ];
  return (
    <ToolResultTable
      rows={rows}
      cols={cols}
      label="Templates"
      ctx={ctx}
      collapseKey={`list_templates_${ctx.turnsAgo}`}
    />
  );
});

// Deployments: table
registerRenderer("list_deployments", (result, ctx) => {
  const rows = extractArray(result) as Record<string, unknown>[];
  if (rows.length === 0) return null;
  const cols: TableCol[] = [
    { header: "Agent", key: "agent_name" },
    { header: "Customer", key: "customer_name" },
    { header: "Deployed", key: "deployed_at", cell: (v) => <span className="num text-ink-3">{safeStr(v).slice(0, 10)}</span> },
    { header: "Hrs replaced", key: "hours_replaced_per_week", cell: (v) => <span className="num text-ink">{safeStr(v)}</span> },
  ];
  return (
    <ToolResultTable
      rows={rows}
      cols={cols}
      label="Deployments"
      ctx={ctx}
      collapseKey={`list_deployments_${ctx.turnsAgo}`}
    />
  );
});

// Mutation tools → ✓ chip
for (const name of ["engagement_mark_touched", "attention_snooze", "attention_resolve", "customer_set_health", "engagement_set_phase", "engagement_set_health"]) {
  const label = name.replace(/_/g, " ");
  registerRenderer(name, (result) => <ToolResultChips result={result} label={label} />);
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export function ToolResult({ tool, turnsAgo }: { tool: ToolActivity; turnsAgo: number }) {
  const ctx: RendererCtx = { turnsAgo };
  const renderer = getRenderer(tool.name);

  if (tool.result === undefined) return null;

  if (renderer) {
    const node = renderer(tool.result, ctx);
    if (!node) return null;
    return <div className="mt-2">{node}</div>;
  }

  // Unknown tool → JSON fallback
  const collapseKey = `unknown_${normalizeToolName(tool.name)}_${turnsAgo}`;
  return (
    <div className="mt-2">
      <JsonFallback result={tool.result} ctx={ctx} collapseKey={collapseKey} />
    </div>
  );
}

// Re-export so chat-landing can import
export { extractArray };
