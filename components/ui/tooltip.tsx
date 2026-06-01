"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import * as React from "react";

import { cn } from "@/lib/utils";

// Provider — wrap at app root or per-group for shared delay config.
// delay and closeDelay live here, not on Root.
const TooltipProvider = TooltipPrimitive.Provider;

// Root — controls open state
const TooltipRoot = TooltipPrimitive.Root;

// Trigger — wraps the anchor element
const TooltipTrigger = TooltipPrimitive.Trigger;

// Portal
const TooltipPortal = TooltipPrimitive.Portal;

// Positioner
const TooltipPositioner = ({
  className,
  ...props
}: TooltipPrimitive.Positioner.Props) => (
  <TooltipPrimitive.Positioner
    className={cn("z-[var(--z-tooltip,50)]", className)}
    {...props}
  />
);
TooltipPositioner.displayName = "TooltipPositioner";

// Popup — styled per §3.14: bg-ink text-paper text-xs px-2 py-1 rounded-sm shadow-base
const TooltipPopup = React.forwardRef<
  HTMLDivElement,
  TooltipPrimitive.Popup.Props
>(({ className, ...props }, ref) => (
  <TooltipPrimitive.Popup
    ref={ref}
    className={cn(
      "bg-ink text-paper text-xs px-2 py-1 rounded-sm shadow-[var(--shadow-base)]",
      "max-w-[280px] leading-snug",
      "transition-[opacity,transform] duration-quick ease-out",
      "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
      className,
    )}
    {...props}
  />
));
TooltipPopup.displayName = "TooltipPopup";

// Convenience composed Tooltip
// Usage: <Tooltip content="tip text"><button>…</button></Tooltip>
type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
  side?: "top" | "bottom" | "left" | "right";
};

function Tooltip({ content, children, delay = 400, side = "top" }: TooltipProps) {
  return (
    <TooltipProvider delay={delay} closeDelay={100}>
      <TooltipRoot>
        <TooltipTrigger render={children as React.ReactElement} />
        <TooltipPortal>
          <TooltipPositioner side={side} sideOffset={6}>
            <TooltipPopup>{content}</TooltipPopup>
          </TooltipPositioner>
        </TooltipPortal>
      </TooltipRoot>
    </TooltipProvider>
  );
}

export {
  Tooltip,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipPortal,
  TooltipPositioner,
  TooltipPopup,
};
