"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import * as React from "react";

import { cn } from "@/lib/utils";

// Root
const PopoverRoot = PopoverPrimitive.Root;

// Trigger
const PopoverTrigger = PopoverPrimitive.Trigger;

// Close
const PopoverClose = PopoverPrimitive.Close;

// Portal
const PopoverPortal = PopoverPrimitive.Portal;

// Backdrop (optional, for modal-like popovers)
const PopoverBackdrop = ({
  className,
  ...props
}: PopoverPrimitive.Backdrop.Props) => (
  <PopoverPrimitive.Backdrop
    className={cn("fixed inset-0 z-[var(--z-overlay,20)]", className)}
    {...props}
  />
);
PopoverBackdrop.displayName = "PopoverBackdrop";

// Positioner
const PopoverPositioner = ({
  className,
  ...props
}: PopoverPrimitive.Positioner.Props) => (
  <PopoverPrimitive.Positioner
    className={cn("z-[var(--z-overlay,20)]", className)}
    {...props}
  />
);
PopoverPositioner.displayName = "PopoverPositioner";

// Popup — §3.15: bg-canvas shadow-lg rounded-lg p-2 border border-line
const PopoverPopup = React.forwardRef<
  HTMLDivElement,
  PopoverPrimitive.Popup.Props
>(({ className, ...props }, ref) => (
  <PopoverPrimitive.Popup
    ref={ref}
    className={cn(
      "bg-canvas border border-line shadow-[var(--shadow-lg)] rounded-lg p-2 min-w-[12rem]",
      "transition-[opacity,transform] duration-quick ease-out",
      "data-[starting-style]:opacity-0 data-[starting-style]:translate-y-2",
      "data-[ending-style]:opacity-0 data-[ending-style]:translate-y-2",
      className,
    )}
    {...props}
  />
));
PopoverPopup.displayName = "PopoverPopup";

// PopoverItem — styled list item inside popup
const PopoverItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-ink cursor-default select-none",
      "hover:bg-surface-1 focus:outline-none focus:bg-surface-1",
      "transition-colors duration-instant",
      "disabled:opacity-45 disabled:cursor-not-allowed",
      className,
    )}
    {...props}
  />
));
PopoverItem.displayName = "PopoverItem";

// Convenience Popover — takes a trigger and content
type PopoverProps = {
  trigger: React.ReactElement;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
};

function Popover({ trigger, children, side = "bottom", align = "start" }: PopoverProps) {
  return (
    <PopoverRoot>
      <PopoverTrigger render={trigger} />
      <PopoverPortal>
        <PopoverPositioner side={side} align={align} sideOffset={6}>
          <PopoverPopup>{children}</PopoverPopup>
        </PopoverPositioner>
      </PopoverPortal>
    </PopoverRoot>
  );
}

export {
  Popover,
  PopoverRoot,
  PopoverTrigger,
  PopoverClose,
  PopoverPortal,
  PopoverBackdrop,
  PopoverPositioner,
  PopoverPopup,
  PopoverItem,
};
