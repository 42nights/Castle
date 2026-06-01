"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base: no translate-y, soft amber focus ring, accessible disabled
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-sm font-medium whitespace-nowrap select-none transition-[background-color,box-shadow,opacity] outline-none" +
    " focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none" +
    " disabled:opacity-45 disabled:pointer-events-none disabled:cursor-not-allowed" +
    " aria-disabled:opacity-45 aria-disabled:pointer-events-none" +
    " [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Primary: ink bg, paper text
        default:
          "bg-ink text-paper shadow-[var(--shadow-sm)] hover:bg-ink-2 hover:shadow-[var(--shadow-base)] active:bg-ink-2 active:shadow-[var(--shadow-xs)]",
        // Outline: canvas bg, ink text, line border
        outline:
          "bg-canvas text-ink border border-line shadow-[var(--shadow-xs)] hover:bg-surface-1 hover:border-line-strong active:bg-surface-2",
        // Secondary: surface-1 bg
        secondary:
          "bg-surface-1 text-ink hover:bg-surface-2 active:bg-surface-2",
        // Ghost: transparent, surface-1 hover
        ghost:
          "bg-transparent text-ink hover:bg-surface-1 active:bg-surface-2",
        // Destructive: health-soft-bad bg, health-bad text
        destructive:
          "bg-health-soft-bad text-health-bad hover:bg-[color-mix(in_srgb,var(--color-health-soft-bad)_85%,var(--color-health-bad)_15%)] active:bg-[color-mix(in_srgb,var(--color-health-soft-bad)_70%,var(--color-health-bad)_30%)]",
        // Link: accent text, underline on hover
        link: "bg-transparent text-accent underline-offset-4 hover:underline shadow-none",
      },
      size: {
        default: "h-8 px-3 text-sm",
        xs: "h-6 px-2 text-xs rounded-[min(var(--radius-sm),10px)] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 px-2.5 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 px-4 text-base",
        icon: "size-8",
        "icon-xs": "size-6 rounded-[min(var(--radius-sm),10px)] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
    iconStart?: React.ReactNode;
    iconEnd?: React.ReactNode;
    asChild?: boolean;
  };

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  iconStart,
  iconEnd,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      disabled={disabled || loading}
      aria-busy={loading ? "true" : undefined}
      aria-disabled={(disabled || loading) ? "true" : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <>
          {iconStart && (
            <span data-icon="inline-start" aria-hidden="true">
              {iconStart}
            </span>
          )}
          {children}
          {iconEnd && (
            <span data-icon="inline-end" aria-hidden="true">
              {iconEnd}
            </span>
          )}
        </>
      )}
    </ButtonPrimitive>
  );
}

export { Button, buttonVariants };
