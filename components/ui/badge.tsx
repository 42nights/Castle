import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// ---- Badge: small inline status marker ----
// Variants kept exactly as before (default/secondary/destructive/outline/ghost/link)
// Visual updated to Paper design system.

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 text-xs font-medium whitespace-nowrap transition-colors focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "bg-ink text-paper [a]:hover:bg-ink-2",
        secondary:
          "bg-surface-1 text-ink-2 border-line [a]:hover:bg-surface-2",
        destructive:
          "bg-health-soft-bad text-health-bad [a]:hover:bg-[color-mix(in_srgb,var(--color-health-soft-bad)_80%,var(--color-health-bad)_20%)]",
        outline:
          "border-line text-ink bg-transparent [a]:hover:bg-surface-1",
        ghost:
          "bg-transparent text-ink-2 hover:bg-surface-1 hover:text-ink",
        link: "text-accent underline-offset-4 hover:underline bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

// ---- Chip: interactive filter pill ----

type ChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

function Chip({ className, active = false, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full border px-3 text-sm transition-colors duration-quick outline-none",
        "focus-visible:shadow-[var(--shadow-focus)]",
        active
          ? "bg-ink text-paper border-ink"
          : "bg-canvas text-ink-2 border-line hover:border-line-strong hover:text-ink hover:bg-surface-1",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ---- Tag: editorial label with leading # in mono ----

type TagProps = React.HTMLAttributes<HTMLSpanElement> & {
  asButton?: boolean;
  active?: boolean;
};

function Tag({ className, children, asButton = false, active = false, ...props }: TagProps) {
  const base = cn(
    "inline-flex h-6 items-center gap-0.5 rounded-sm px-2 text-xs bg-surface-1 text-ink-2 transition-colors duration-quick",
    active && "bg-accent-soft text-accent-ink",
    asButton && "cursor-pointer hover:bg-surface-2 outline-none focus-visible:shadow-[var(--shadow-focus)]",
    className,
  );

  const inner = (
    <>
      <span className="font-mono text-ink-3 mr-0.5">#</span>
      {children}
    </>
  );

  if (asButton) {
    return (
      <button type="button" className={base} {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
        {inner}
      </button>
    );
  }

  return (
    <span className={base} {...props}>
      {inner}
    </span>
  );
}

export { Badge, badgeVariants, Chip, Tag };
