"use client";

import { Castle as CastleIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ActorBar } from "@/components/actor-bar";
import { InFlightDot } from "@/components/in-flight-dot";

const links = [
  { href: "/", label: "Ask" },
  { href: "/overview", label: "Overview" },
  { href: "/fdes", label: "FDEs" },
  { href: "/engagements", label: "Engagements" },
  { href: "/customers", label: "Customers" },
  { href: "/templates", label: "Templates" },
  { href: "/extractions", label: "Extractions" },
  { href: "/connections", label: "Connections" },
] as const;

/**
 * Top nav.
 *
 * The accent dot is the brand mark — single chromatic moment in the
 * shell. ⌘K is the only meta hint shown at rest (right side), and only
 * on wide screens. Active link gets a 1px ink underline aligned to the
 * nav's bottom border, so the "you are here" feels continuous with the
 * rule instead of pasted on.
 */
export function TopNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-page/90 backdrop-blur supports-[backdrop-filter]:bg-page/75">
      <div className="mx-auto flex h-14 max-w-screen-xl items-center gap-10 px-8 md:px-12">
        <Link
          href="/"
          className="group flex items-baseline gap-2"
          aria-label="Castle"
        >
          <span className="relative inline-flex translate-y-[1px] text-ink">
            <CastleIcon size={16} strokeWidth={1.75} aria-hidden />
            <span className="absolute -top-1.5 -right-1.5">
              <InFlightDot />
            </span>
          </span>
          <span className="t-display text-[18px] leading-none text-ink group-hover:opacity-80 transition-opacity">
            Castle
          </span>
        </Link>

        <nav className="flex items-center gap-1">
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
                  "relative px-2.5 py-2 text-[13px] tracking-[-0.005em] transition-colors",
                  active
                    ? "text-ink"
                    : "text-ink-3 hover:text-ink",
                ].join(" ")}
              >
                {link.label}
                {active && (
                  <span className="absolute left-2.5 right-2.5 -bottom-[1px] h-[1.5px] bg-ink" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-5">
          <ActorBar />
          <span className="hidden lg:inline text-[11px] text-ink-3">
            <kbd className="num text-[10px] text-ink-2">⌘K</kbd>
          </span>
        </div>
      </div>
    </header>
  );
}
