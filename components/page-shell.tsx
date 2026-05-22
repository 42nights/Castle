import { ReactNode } from "react";

/**
 * Page container. 1280px max. Tight B2B padding.
 */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-screen-xl px-6 md:px-10 py-5 md:py-6">
      {children}
    </main>
  );
}

/**
 * Page header. Small h1, hairline divider below.
 *
 * `kicker` is a breadcrumb (e.g. "← Engagements"), rendered above title.
 */
export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between border-b border-line pb-3 mb-5">
      <div className="min-w-0">
        {kicker && (
          <div className="mb-1 text-[13px] text-ink-2 [&_a]:text-ink-2 [&_a:hover]:text-ink [&_a]:transition-colors">
            {kicker}
          </div>
        )}
        <h1 className="t-h1 text-ink">{title}</h1>
        {description && (
          <p className="mt-0.5 text-ink-2 text-[12px] leading-snug max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}

/**
 * Section header. Uppercase mini-label, terse.
 */
export function SectionHeader({
  title,
  description,
  right,
}: {
  title: string;
  description?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6 mb-2">
      <div>
        <h2 className="t-h2 text-ink">{title}</h2>
        {description && (
          <p className="mt-0.5 text-ink-2 text-[11.5px] leading-snug max-w-xl">
            {description}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}

export function Section({ children }: { children: ReactNode }) {
  return <section className="mb-6">{children}</section>;
}
