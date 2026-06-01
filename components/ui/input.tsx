import * as React from "react";

import { cn } from "@/lib/utils";

// Standard input — border/shadow at rest, amber focus ring
type InputProps = React.ComponentProps<"input"> & {
  variant?: "default" | "inline";
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant = "default", type, ...props }, ref) => {
    if (variant === "inline") {
      return (
        <input
          type={type}
          ref={ref}
          className={cn(
            // Inline-editable: at rest looks like text; dotted underline on hover advertises editability
            "bg-transparent border-b border-dotted border-transparent text-sm text-ink outline-none",
            "hover:bg-surface-1 hover:border-line",
            "focus:bg-canvas focus:border-b focus:border-solid focus:border-line-focus focus:shadow-[var(--shadow-focus)]",
            "placeholder:text-ink-4 disabled:opacity-45 disabled:cursor-not-allowed",
            "transition-[background-color,box-shadow,border-color] duration-quick",
            "cursor-text px-1.5 py-0.5 rounded-sm",
            className,
          )}
          {...props}
        />
      );
    }

    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-9 w-full rounded-sm border border-line bg-canvas px-3 text-sm text-ink",
          "shadow-[var(--shadow-xs)]",
          "placeholder:text-ink-4",
          "hover:border-line-strong",
          "focus:outline-none focus:border-line-focus focus:shadow-[var(--shadow-focus)]",
          "disabled:bg-surface-1 disabled:text-ink-3 disabled:cursor-not-allowed",
          "aria-invalid:border-health-bad aria-invalid:focus:shadow-[0_0_0_3px_rgba(178,85,72,0.18)]",
          "transition-[border-color,box-shadow] duration-quick",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
