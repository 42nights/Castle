import { ReactNode } from "react";

/**
 * Skeleton primitives — quiet pulsing placeholders that mirror Castle's
 * existing chrome (`.panel`, `.panel-header`, `.panel-body`, `.ledger`
 * from `app/globals.css`). Used by every `loading.tsx` route segment
 * so the user sees the *shape* of the page within ~16ms of clicking
 * a link, then content streams in.
 *
 * Visual contract: pulse on `bg-surface-2` (one tone above `bg-surface`)
 * so bars read as structural negative space, not loud spinners.
 */

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block rounded-sm bg-surface-2 animate-pulse align-middle ${
        className ?? ""
      }`}
      style={style}
    />
  );
}

/** Page header skeleton — mirrors `PageHeader` from `components/page-shell.tsx`. */
export function PageHeaderSkeleton({
  kicker = false,
  description = true,
  actions = 0,
}: {
  kicker?: boolean;
  description?: boolean;
  actions?: number;
}) {
  return (
    <header className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between border-b border-line pb-3 mb-5">
      <div className="min-w-0">
        {kicker && <Skeleton className="mb-1.5 h-[10px] w-[80px]" />}
        <Skeleton className="block h-[20px] w-[240px]" />
        {description && (
          <Skeleton className="mt-1.5 block h-[12px] w-[320px]" />
        )}
      </div>
      {actions > 0 && (
        <div className="flex items-center gap-2 shrink-0">
          {Array.from({ length: actions }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-[112px]" />
          ))}
        </div>
      )}
    </header>
  );
}

/** Panel skeleton — matches `.panel` containers used everywhere. */
export function PanelSkeleton({
  count,
  rows = 4,
  children,
}: {
  /** Optional count badge to mirror panel headers like `Engagements · 5`. */
  count?: boolean;
  /** Number of ledger rows to render in the body. */
  rows?: number;
  /** Override body content (e.g. a different shape than ledger rows). */
  children?: ReactNode;
}) {
  return (
    <section className="panel mb-4">
      <header className="panel-header">
        <div className="flex items-baseline gap-2">
          <Skeleton className="h-[13px] w-[96px]" />
          {count && <Skeleton className="h-[10px] w-[20px]" />}
        </div>
        <Skeleton className="h-[10px] w-[60px]" />
      </header>
      {children ? (
        <div className="panel-body no-pad">{children}</div>
      ) : (
        <ul className="ledger">
          {Array.from({ length: rows }).map((_, i) => (
            <li
              key={i}
              className="px-3 py-2 flex items-baseline justify-between gap-3"
            >
              <Skeleton className="h-[13px]" style={{ width: `${30 + ((i * 17) % 40)}%` }} />
              <Skeleton className="h-[11px] w-[80px]" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 4-column stats strip skeleton — matches customer / fde / template
 *  detail page Stats panels. */
export function StatsStripSkeleton({ cells = 4 }: { cells?: number }) {
  return (
    <section className="panel mb-4">
      <header className="panel-header">
        <Skeleton className="h-[13px] w-[60px]" />
      </header>
      <div
        className="grid divide-x divide-line"
        style={{ gridTemplateColumns: `repeat(${cells}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cells }).map((_, i) => (
          <div key={i} className="px-3 py-3 flex flex-col gap-1.5">
            <Skeleton className="h-[10px] w-[64px]" />
            <Skeleton className="h-[20px] w-[72px]" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Table skeleton — header row + N body rows × M cells. */
export function TableSkeleton({
  cols = 6,
  rows = 10,
}: {
  cols?: number;
  rows?: number;
}) {
  return (
    <section className="panel mb-4 panel-body no-pad">
      <table className="w-full">
        <thead>
          <tr className="border-b border-line">
            {Array.from({ length: cols }).map((_, c) => (
              <th key={c} className="text-left h-9 px-3 align-middle">
                <Skeleton className="h-[9px] w-[60px]" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="border-b border-line last:border-b-0">
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} className="px-3 py-2.5 align-middle">
                  <Skeleton
                    className="h-[13px]"
                    style={{ width: `${40 + ((r * 11 + c * 23) % 50)}%` }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Card grid skeleton — for `/templates` (3-up template cards). */
export function CardGridSkeleton({
  cards = 6,
  cols = 3,
}: {
  cards?: number;
  cols?: number;
}) {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          className="panel p-3 flex flex-col gap-2"
        >
          <Skeleton className="h-[14px] w-[60%]" />
          <Skeleton className="h-[11px] w-[80%]" />
          <Skeleton className="h-[11px] w-[40%]" />
          <div className="mt-2 pt-2 border-t border-line">
            <Skeleton className="h-[10px] w-[50%]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Wraps a loading shell in the same `PageShell` container as live pages. */
export function PageShellSkeleton({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-screen-xl px-6 md:px-10 py-5 md:py-6">
      {children}
    </main>
  );
}
