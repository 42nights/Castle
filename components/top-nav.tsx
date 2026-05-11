"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Overview" },
  { href: "/fdes", label: "FDEs" },
  { href: "/engagements", label: "Engagements" },
  { href: "/customers", label: "Customers" },
  { href: "/templates", label: "Templates" },
  { href: "/extractions", label: "Extractions" },
] as const;

export function TopNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-page/85 backdrop-blur supports-[backdrop-filter]:bg-page/70">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-10 px-6 md:px-10">
        <Link
          href="/"
          className="group flex items-baseline gap-2.5"
          aria-label="Castle, by 42nights Inc."
        >
          <span className="inline-block h-1.5 w-1.5 translate-y-[-2px] rounded-full bg-accent" />
          <span className="t-display text-[19px] leading-none text-ink group-hover:opacity-80 transition-opacity">
            Castle
          </span>
          <span className="t-caption translate-y-[-1px]">
            by 42nights Inc.
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
                  "relative px-3 py-1.5 text-[13px] tracking-[-0.005em] rounded-sm transition-colors",
                  active
                    ? "text-ink"
                    : "text-ink-2 hover:text-ink hover:bg-surface",
                ].join(" ")}
              >
                {link.label}
                {active && (
                  <span className="absolute left-3 right-3 -bottom-[15px] h-px bg-ink" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="t-caption hidden md:inline">
            Internal · operator console
          </span>
        </div>
      </div>
    </header>
  );
}
