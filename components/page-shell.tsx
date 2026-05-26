import { ReactNode } from "react";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[1280px] px-6 md:px-8 py-6 md:py-8">
      {children}
    </main>
  );
}

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
    <header className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between pb-4 mb-6 border-b border-line">
      <div className="min-w-0">
        {kicker && (
          <div className="mb-1.5 text-[13px] text-ink-2 [&_a]:text-ink-2 [&_a:hover]:text-ink [&_a]:transition-colors">
            {kicker}
          </div>
        )}
        <h1 className="t-h1 text-ink">{title}</h1>
        {description && (
          <p className="mt-1 text-ink-3 text-[13px] leading-snug max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}

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
    <div className="flex items-baseline justify-between gap-6 mb-3">
      <div>
        <h2 className="t-h2">{title}</h2>
        {description && (
          <p className="mt-0.5 text-ink-3 text-[12px] leading-snug max-w-xl">
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
