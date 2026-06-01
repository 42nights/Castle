"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// Toast styling per §3.6:
// Container: bg-canvas, shadow-md, rounded-md, border border-line, px-4 py-3
// Variant left-borders: success=health-good, warn=health-warn, error=health-bad, info=accent
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="bottom-right"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex items-start gap-3 w-full bg-canvas border border-line rounded-md px-4 py-3 shadow-[var(--shadow-md)] text-sm text-ink font-sans",
          title: "font-medium text-ink",
          description: "text-ink-2 text-xs mt-0.5",
          icon: "mt-0.5 shrink-0",
          // Variant left borders
          success: "border-l-4 border-l-health-good",
          warning: "border-l-4 border-l-health-warn",
          error: "border-l-4 border-l-health-bad",
          info: "border-l-4 border-l-accent",
          // Action/cancel buttons
          actionButton:
            "bg-ink text-paper text-xs px-2 py-1 rounded-sm hover:bg-ink-2 transition-colors ml-auto shrink-0",
          cancelButton:
            "bg-surface-1 text-ink-2 text-xs px-2 py-1 rounded-sm hover:bg-surface-2 transition-colors",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
