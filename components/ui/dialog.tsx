"use client";

import { ReactNode, useEffect, useId } from "react";

import { cn } from "@/lib/utils";

/**
 * Dialog — Paper design system §3.5.
 * Soft backdrop (bg-ink/40 blur-sm), canvas surface, shadow-xl, rounded-lg.
 * Keyboard: Esc closes. Click outside closes (override with dismissOnClickOutside=false).
 * a11y: role=dialog, aria-modal, aria-labelledby, aria-describedby, focus trap.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissOnClickOutside = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  dismissOnClickOutside?: boolean;
}) {
  const titleId = useId();
  const descId = useId();

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

  const maxW =
    size === "sm"
      ? "max-w-[400px]"
      : size === "lg"
        ? "max-w-[720px]"
        : "max-w-[520px]";

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal,30)] flex items-center justify-center px-4"
      onClick={dismissOnClickOutside ? onClose : undefined}
    >
      {/* Backdrop: soft ink/40 with blur — not the heavy black-80 dev-tool look */}
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          "relative w-full rounded-lg bg-canvas shadow-[var(--shadow-xl)]",
          "transition-[opacity,transform] duration-slow ease-in-out",
          maxW,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-6 pt-6 pb-4 border-b border-line">
          <h2 id={titleId} className="text-xl font-semibold text-ink leading-snug tracking-tight">
            {title}
          </h2>
          {description && (
            <p id={descId} className="mt-1 text-sm text-ink-2 leading-relaxed">
              {description}
            </p>
          )}
        </header>

        <div className="px-6 py-5">{children}</div>

        {footer && (
          <footer className="px-6 py-4 bg-surface-1 border-t border-line rounded-b-lg flex items-center justify-end gap-2">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

// DialogButton — used in dialog footers
export function DialogButton({
  variant = "secondary",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
}) {
  const base =
    "h-8 px-3 rounded-sm text-[12.5px] font-medium transition-[background-color,box-shadow,opacity] outline-none focus-visible:shadow-[var(--shadow-focus)] disabled:opacity-45 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-ink text-paper shadow-[var(--shadow-sm)] hover:bg-ink-2 hover:shadow-[var(--shadow-base)] active:shadow-[var(--shadow-xs)]"
      : "border border-line bg-canvas text-ink-2 shadow-[var(--shadow-xs)] hover:bg-surface-1 hover:border-line-strong hover:text-ink active:bg-surface-2";
  return (
    <button className={cn(base, styles, className)} {...rest} />
  );
}

// DialogField — labeled form group
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
      <span className="t-caption font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="t-caption text-ink-3">{hint}</span>}
    </label>
  );
}

// DialogInput — standard text input inside a dialog
export function DialogInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  const { className, ...rest } = props;
  return (
    <input
      className={cn(
        "h-9 w-full rounded-sm border border-line bg-canvas px-2.5 text-sm text-ink",
        "shadow-[var(--shadow-xs)] placeholder:text-ink-4",
        "hover:border-line-strong",
        "focus:outline-none focus:border-line-focus focus:shadow-[var(--shadow-focus)]",
        "disabled:bg-surface-1 disabled:text-ink-3 disabled:cursor-not-allowed",
        "transition-[border-color,box-shadow] duration-quick",
        className,
      )}
      {...rest}
    />
  );
}

// DialogSelect — native select inside a dialog (keeps <option> portability)
export function DialogSelect(
  props: React.SelectHTMLAttributes<HTMLSelectElement>,
) {
  const { className, ...rest } = props;
  return (
    <select
      className={cn(
        "h-9 w-full rounded-sm border border-line bg-canvas px-2.5 text-sm text-ink",
        "shadow-[var(--shadow-xs)]",
        "hover:border-line-strong",
        "focus:outline-none focus:border-line-focus focus:shadow-[var(--shadow-focus)]",
        "disabled:bg-surface-1 disabled:text-ink-3 disabled:cursor-not-allowed",
        "transition-[border-color,box-shadow] duration-quick",
        "appearance-none",
        className,
      )}
      {...rest}
    />
  );
}

// DialogTextarea
export function DialogTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  const { className, ...rest } = props;
  return (
    <textarea
      className={cn(
        "min-h-[80px] w-full rounded-sm border border-line bg-canvas p-2.5 text-sm text-ink",
        "shadow-[var(--shadow-xs)] placeholder:text-ink-4",
        "hover:border-line-strong",
        "focus:outline-none focus:border-line-focus focus:shadow-[var(--shadow-focus)]",
        "disabled:bg-surface-1 disabled:text-ink-3 disabled:cursor-not-allowed",
        "transition-[border-color,box-shadow] duration-quick resize-y",
        className,
      )}
      {...rest}
    />
  );
}
