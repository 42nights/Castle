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
    <span className="t-caption inline-flex h-5 items-center rounded-xs border border-line px-1.5 text-ink-2 uppercase tracking-[0.08em]">
      {phase}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="t-caption inline-flex h-5 items-center rounded-xs border border-line bg-surface-1 px-1.5 text-ink tracking-[0.06em]">
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
  const healthMap = {
    active: "green",
    paused: "yellow",
    churned: "red",
  } as const;
  return (
    <span className="t-caption inline-flex items-center gap-1.5">
      <span className="hp" data-health={healthMap[status]} />
      {labelMap[status]}
    </span>
  );
}

/**
 * §3.19 — Deterministic warm-toned avatar derived from name hash.
 * Supported sizes: 20, 24, 28, 32, 40, 56, 80.
 */

// Warm palette — sage, terracotta, honey, dusty — never bright primaries
const AVATAR_PALETTES: Array<{ bg: string; fg: string }> = [
  { bg: "#DAE5DA", fg: "#3D6B3D" }, // sage
  { bg: "#F0DDD8", fg: "#7A3B2E" }, // terracotta
  { bg: "#F5E6CC", fg: "#6B4513" }, // honey
  { bg: "#E8E2DE", fg: "#5A5250" }, // dusty
  { bg: "#E4EDE4", fg: "#3D6B3D" }, // soft sage
  { bg: "#EDE8E0", fg: "#5A4D3A" }, // warm sand
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function avatarFontSize(size: number): number {
  // ~40% of avatar size, capped reasonably
  return Math.round(size * 0.38);
}

export function Avatar({
  name,
  size = 22,
}: {
  name: string;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const palette = AVATAR_PALETTES[hashName(name) % AVATAR_PALETTES.length];
  const fontSize = avatarFontSize(size);

  return (
    <span
      role="img"
      aria-label={name}
      className="inline-flex items-center justify-center rounded-full border border-line font-semibold tracking-[0.03em] shrink-0"
      style={{
        width: size,
        height: size,
        background: palette.bg,
        color: palette.fg,
        fontSize,
      }}
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
          className="ring-2 ring-paper rounded-full"
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
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`relative h-1.5 w-full overflow-hidden rounded-full bg-surface-2 ${className}`}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-slow"
        style={{ width: `${clamped}%` }}
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
