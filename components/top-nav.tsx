"use client";

import { Castle as CastleIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { InFlightDot } from "@/components/in-flight-dot";
import { ProfileMenu } from "@/components/profile-menu";

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

export function TopNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-page/80 backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-[1280px] items-center gap-8 px-6 md:px-8">
        <Link
          href="/"
          className="group flex items-center gap-2"
          aria-label="Castle"
        >
          <span className="relative inline-flex text-ink">
            <CastleIcon size={15} strokeWidth={1.75} aria-hidden />
            <span className="absolute -top-1 -right-1">
              <InFlightDot />
            </span>
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-ink group-hover:opacity-80 transition-opacity">
            Castle
          </span>
        </Link>

        <nav className="flex items-center gap-0.5">
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
                  "relative px-2.5 py-1.5 rounded-md text-[13px] transition-colors",
                  active
                    ? "text-ink bg-surface"
                    : "text-ink-3 hover:text-ink hover:bg-surface/50",
                ].join(" ")}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <span className="hidden lg:inline text-[11px] text-ink-3">
            <kbd className="num text-[10px] text-ink-2 bg-surface px-1.5 py-0.5 rounded">
              &#8984;K
            </kbd>
          </span>
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}
