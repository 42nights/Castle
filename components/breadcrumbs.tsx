"use client";

// Breadcrumbs — §6.1
// Auto-generates a breadcrumb trail from the current pathname.
// Each segment is a link; the last segment is the current page (not a link).
// Uses nav/ol semantics per ARIA Practices for breadcrumbs.
// Separators are rendered in font-mono for the editorial mono-separator look.
//
// Usage: drop into PageHeader's `kicker` slot on detail pages.
//
//   <PageHeader kicker={<Breadcrumbs />} title={...} />
//
// The component auto-reads the pathname; no props required.
// Override with `items` if the pathname-derived trail needs adjustment.

import Link from "next/link";
import { usePathname } from "next/navigation";

// Map raw path segments to a human-readable label.
// Extend this map as new routes are added.
const SEGMENT_LABELS: Record<string, string> = {
  "":           "Home",
  overview:     "Overview",
  templates:    "Templates",
  customers:    "Customers",
  engagements:  "Engagements",
  extractions:  "Extractions",
  fdes:         "FDEs",
  connections:  "Connections",
  settings:     "Settings",
  access:       "Access",
  assistant:    "Assistant",
};

function labelFor(segment: string): string {
  return SEGMENT_LABELS[segment] ?? segment.replace(/-/g, " ");
}

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbsProps {
  /** Override the auto-generated items. */
  items?: BreadcrumbItem[];
  /** Root label; defaults to "Castle". */
  rootLabel?: string;
}

export function Breadcrumbs({ items, rootLabel = "Castle" }: BreadcrumbsProps) {
  const pathname = usePathname();

  const resolved: BreadcrumbItem[] = items ?? buildItems(pathname, rootLabel);

  if (resolved.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center flex-wrap gap-0 list-none m-0 p-0">
        {resolved.map((item, i) => {
          const isLast = i === resolved.length - 1;
          return (
            <li key={item.href} className="flex items-center">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className="mx-1.5 font-mono text-[11px] text-ink-4 select-none"
                >
                  /
                </span>
              )}
              {isLast ? (
                <span aria-current="page" className="text-ink text-[13px]">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="text-ink-2 text-[13px] hover:text-ink transition-colors duration-quick"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function buildItems(pathname: string, rootLabel: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);

  const items: BreadcrumbItem[] = [{ label: rootLabel, href: "/" }];

  let acc = "";
  for (const seg of segments) {
    acc += `/${seg}`;
    items.push({ label: labelFor(seg), href: acc });
  }

  return items;
}
