"use client";

import { Castle as CastleIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { InFlightDot } from "@/components/in-flight-dot";
import { ProfileMenu } from "@/components/profile-menu";
import { ThemeToggle } from "@/components/theme-toggle";

const operatorLinks = [
  { href: "/", label: "Ask" },
  { href: "/overview", label: "Overview" },
  { href: "/fdes", label: "FDEs" },
  { href: "/engagements", label: "Engagements" },
  { href: "/customers", label: "Customers" },
  { href: "/templates", label: "Templates" },
  { href: "/extractions", label: "Extractions" },
  { href: "/connections", label: "Connections" },
] as const;

const guestLinks = [
  { href: "/templates", label: "Templates" },
] as const;

export function TopNav() {
  const pathname = usePathname();
  const user = useQuery(api.auth.getCurrentUser);
  const isOp = user?.isOperator ?? false;
  const links = isOp ? operatorLinks : guestLinks;

  return (
    <header className="sticky top-0 z-[var(--z-sticky,10)] border-b border-line bg-paper/90">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-6 px-6 md:px-8">
        {/* Brand */}
        <Link
          href={isOp ? "/" : "/templates"}
          className="group flex items-center gap-2 pr-2 shrink-0"
          aria-label="Castle home"
        >
          <span className="relative inline-flex text-ink">
            <CastleIcon size={18} strokeWidth={1.75} aria-hidden />
            <span className="absolute -top-1 -right-1">
              <InFlightDot />
            </span>
          </span>
          <span className="text-[16px] font-semibold tracking-tight text-ink group-hover:opacity-75 transition-opacity duration-quick">
            Castle
          </span>
        </Link>

        {/* Nav links — accent-underline active state (::after 2px in accent) */}
        <nav aria-label="Main navigation" className="flex items-center gap-0.5">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={[
                  // Base shape
                  "relative h-8 px-3 flex items-center rounded-sm text-sm transition-colors duration-quick",
                  // Active: ink text + 2px accent underline via pseudo
                  // Inactive: ink-3, hover lifts to ink + surface bg
                  active
                    ? "text-ink after:absolute after:bottom-0 after:left-3 after:right-3 after:h-[2px] after:rounded-full after:bg-accent"
                    : "text-ink-3 hover:text-ink hover:bg-surface-1",
                ].join(" ")}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right slot: ⌘K hint + profile */}
        <div className="ml-auto flex items-center gap-3">
          {isOp && (
            // "Ask Castle ⌘K" — real button, visible md+, opens palette
            // 'use client' component so the click can dispatch the keyboard event
            <CmdKHint />
          )}
          <ThemeToggle />
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}

// Separate component so we can use the window event without polluting TopNav
function CmdKHint() {
  const open = () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
    );
  };

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Open command palette (⌘K)"
      className={[
        "hidden md:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-sm",
        "text-ink-3 text-[13px] hover:bg-surface-1 hover:text-ink",
        "transition-colors duration-quick outline-none",
        "focus-visible:shadow-[var(--shadow-focus)]",
      ].join(" ")}
    >
      Ask Castle
      <kbd className="font-mono text-[11px] text-ink-3 bg-surface-1 border border-line px-1 py-px rounded-sm leading-none">
        ⌘K
      </kbd>
    </button>
  );
}
