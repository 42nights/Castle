import Link from "next/link";
import { ReactNode } from "react";
import { Health } from "@/lib/types";

export function HealthPip({
  value,
  label,
}: {
  value: Health | "—";
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="hp" data-health={value === "—" ? undefined : value} />
      {label && <span className="t-caption">{label}</span>}
    </span>
  );
}

export function PhaseBadge({ phase }: { phase: string }) {
  return (
    <span className="t-caption inline-flex h-5 items-center rounded-sm border border-line px-1.5 text-ink-2 uppercase tracking-[0.08em]">
      {phase}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="t-caption inline-flex h-5 items-center rounded-sm border border-line bg-surface px-1.5 text-ink tracking-[0.06em]">
      {category}
    </span>
  );
}

export function StatusChip({
  status,
}: {
  status: "active" | "churned" | "paused";
}) {
  const labelMap = { active: "Active", churned: "Churned", paused: "Paused" };
  return (
    <span className="t-caption inline-flex items-center gap-1.5">
      <span
        className="hp"
        data-health={
          status === "active" ? "green" : status === "paused" ? "yellow" : "red"
        }
      />
      {labelMap[status]}
    </span>
  );
}

export function Avatar({ name, size = 22 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-surface border border-line text-[10px] font-medium tracking-[0.04em] text-ink"
      style={{ width: size, height: size }}
      title={name}
    >
      {initials}
    </span>
  );
}

export function AvatarGroup({ names }: { names: string[] }) {
  return (
    <span className="inline-flex items-center">
      {names.map((n, i) => (
        <span
          key={n + i}
          style={{ marginLeft: i === 0 ? 0 : -6 }}
          className="ring-2 ring-page rounded-full"
        >
          <Avatar name={n} />
        </span>
      ))}
    </span>
  );
}

export function ProgressBar({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      className={`relative h-1 w-full overflow-hidden rounded-sm bg-surface ${className}`}
    >
      <div
        className="absolute inset-y-0 left-0 bg-ink"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="border-t border-line pt-4">
      <div className="t-caption mb-2">{label}</div>
      <div className="t-display text-[44px] leading-[44px] text-ink">
        {value}
      </div>
      {sub && <div className="mt-2 text-ink-2 text-[13px]">{sub}</div>}
    </div>
  );
}

export function SectionLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="t-caption text-ink-2 hover:text-ink transition-colors"
    >
      {children} →
    </Link>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="border border-dashed border-line rounded-md p-8 text-ink-3 text-sm text-center">
      {children}
    </div>
  );
}
