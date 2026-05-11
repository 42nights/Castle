import { ReactNode } from "react";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-screen-2xl px-6 md:px-10 py-10 md:py-14">
      {children}
    </main>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b border-line pb-8 mb-10">
      <div className="max-w-3xl">
        {eyebrow && <div className="t-eyebrow mb-3">{eyebrow}</div>}
        <h1 className="t-h1 text-ink">{title}</h1>
        {description && (
          <p className="mt-3 text-ink-2 max-w-2xl text-[15px] leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </header>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  rightSlot,
}: {
  eyebrow?: string;
  title: string;
  rightSlot?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-6 mb-6 border-b border-line pb-4">
      <div>
        {eyebrow && <div className="t-eyebrow mb-2">{eyebrow}</div>}
        <h2 className="t-h2 text-ink">{title}</h2>
      </div>
      {rightSlot}
    </div>
  );
}
