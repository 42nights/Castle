import { ReactNode } from "react";

// PageShell — outer container for all pages.
// py-12 on the hero header section, px-6/md:px-8 horizontal gutter.
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[1280px] px-6 md:px-8 py-8 md:py-10">
      {children}
    </main>
  );
}

// PageHeader — supports two visual variants:
//   "operator" (default) — Inter 32px h1, compact 24px bottom padding
//   "editorial"          — Fraunces 48px display title, 48px bottom padding
//
// All existing props are preserved; `variant` defaults to "operator" so
// every current caller is unchanged. New optional slots: eyebrow, meta.
export function PageHeader({
  kicker,
  eyebrow,
  title,
  description,
  actions,
  meta,
  variant = "operator",
}: {
  kicker?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  variant?: "operator" | "editorial";
}) {
  const isEditorial = variant === "editorial";

  return (
    <header
      className={[
        "flex flex-col gap-1 md:flex-row md:items-start md:justify-between border-b border-line",
        isEditorial ? "pb-12 mb-10" : "pb-4 mb-6",
      ].join(" ")}
    >
      <div className="min-w-0">
        {/* Kicker — breadcrumb / back link */}
        {kicker && (
          <div className="mb-2 text-[13px] text-ink-2 [&_a]:text-ink-2 [&_a:hover]:text-ink [&_a]:transition-colors">
            {kicker}
          </div>
        )}

        {/* Eyebrow — small uppercase context label */}
        {eyebrow && (
          <div className="mb-2 t-eyebrow">{eyebrow}</div>
        )}

        {/* Title — Fraunces for editorial, Inter for operator */}
        <h1
          className={isEditorial ? "t-display text-ink" : "t-h1 text-ink"}
        >
          {title}
        </h1>

        {description && (
          // <div>, not <p>: some pages (e.g. customer detail) pass block-level
          // controls like BackedByInput as the description, which are invalid
          // inside a <p> and trigger hydration errors. Typography is unchanged.
          <div
            className={[
              "mt-2 text-ink-2 max-w-[60ch]",
              isEditorial
                ? "text-[16px] leading-relaxed"
                : "text-[13px] leading-snug",
            ].join(" ")}
          >
            {description}
          </div>
        )}
      </div>

      {/* Right rail — actions + optional meta */}
      {(actions || meta) && (
        <div className="flex flex-col items-end gap-1.5 shrink-0 mt-1">
          {actions && (
            <div className="flex items-center gap-2">{actions}</div>
          )}
          {meta && (
            <div className="t-caption text-ink-3">{meta}</div>
          )}
        </div>
      )}
    </header>
  );
}

// SectionHeader — operator eyebrow-style section heading.
// Identical public API to before; tokens updated.
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

// Section — spacing wrapper; unchanged.
export function Section({ children }: { children: ReactNode }) {
  return <section className="mb-8">{children}</section>;
}
