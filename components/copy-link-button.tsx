"use client";

// CopyLinkButton — §4.8 deep-link share.
// Copies the production URL (https://castle.42nights.dev{pathname}) to clipboard
// regardless of the current host so a local dev session still produces a
// production link. Shows a sonner toast on success.
// Bound globally to cmd-Shift-C via keyboard-shortcuts.tsx.
// Mount wherever needed; the copy-link icon button appears in detail-page
// header actions slots.

import { Link } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

const PRODUCTION_HOST = "https://castle.42nights.dev";

export function buildProductionUrl(pathname: string): string {
  return `${PRODUCTION_HOST}${pathname}`;
}

export function copyCurrentLink(pathname: string): void {
  const url = buildProductionUrl(pathname);
  navigator.clipboard.writeText(url).then(() => {
    toast("Link copied. Paste in Slack.", {
      duration: 2500,
    });
  }).catch(() => {
    toast.error("Clipboard write failed. Try copying the URL bar manually.");
  });
}

type CopyLinkButtonProps = {
  /** Explicit pathname override. Defaults to the current Next.js pathname. */
  pathname?: string;
};

export function CopyLinkButton({ pathname: pathnameProp }: CopyLinkButtonProps) {
  const routePathname = usePathname();
  const pathname = pathnameProp ?? routePathname;

  // Expose pathname on window so keyboard-shortcuts.tsx can call copyCurrentLink
  // for the current page without prop drilling. Updated on every pathname change.
  useEffect(() => {
    (window as Window & { __copyLinkPathname?: string }).__copyLinkPathname = pathname;
    return () => {
      delete (window as Window & { __copyLinkPathname?: string }).__copyLinkPathname;
    };
  }, [pathname]);

  const handleClick = () => copyCurrentLink(pathname);

  return (
    <Tooltip content="Copy link  ⌘⇧C" side="bottom">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleClick}
        aria-label="Copy link to this page"
      >
        <Link size={14} aria-hidden="true" />
      </Button>
    </Tooltip>
  );
}
