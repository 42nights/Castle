"use client";

import { ReactNode, useEffect } from "react";

/**
 * Minimal modal. No Radix, no portal lib — single-purpose enough we don't
 * need the dependency surface. Click-outside + Esc both close.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const w =
    size === "sm" ? "max-w-md" : size === "lg" ? "max-w-2xl" : "max-w-lg";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal
        className={`relative w-full ${w} rounded-md border border-line bg-page shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-6 pt-5 pb-3 border-b border-line">
          <div className="t-h3">{title}</div>
          {description && (
            <p className="mt-1 text-ink-2 text-[13px] leading-relaxed">
              {description}
            </p>
          )}
        </header>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <footer className="px-6 py-3 border-t border-line bg-surface rounded-b-md flex items-center justify-end gap-2">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

export function DialogButton({
  variant = "secondary",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
}) {
  const base =
    "h-8 px-3 rounded-sm text-[12.5px] transition-colors disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "bg-ink text-page hover:bg-ink/90"
      : "border border-line bg-page text-ink-2 hover:text-ink hover:bg-surface";
  return <button className={`${base} ${styles}`} {...rest} />;
}

export function DialogField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 mb-4">
      <span className="t-caption">{label}</span>
      {children}
      {hint && <span className="t-caption text-ink-3">{hint}</span>}
    </label>
  );
}

export function DialogInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return (
    <input
      {...props}
      className={`h-9 rounded-sm border border-line bg-page px-2.5 text-[13.5px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-ink ${props.className ?? ""}`}
    />
  );
}

export function DialogSelect(
  props: React.SelectHTMLAttributes<HTMLSelectElement>,
) {
  return (
    <select
      {...props}
      className={`h-9 rounded-sm border border-line bg-page px-2 text-[13.5px] text-ink focus:outline-none focus:ring-1 focus:ring-ink ${props.className ?? ""}`}
    />
  );
}

export function DialogTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={`min-h-[80px] rounded-sm border border-line bg-page p-2.5 text-[13.5px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-ink ${props.className ?? ""}`}
    />
  );
}
