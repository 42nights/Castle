export function formatUsdCompact(n: number): string {
  if (n === 0) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2)}M`;
  }
  if (abs >= 10_000) {
    const k = Math.round(n / 1_000);
    // Boundary case: 999_500 rounds to 1000K. Escalate to $1M instead
    // of printing "$1000K" which looks like a formatting glitch.
    if (Math.abs(k) >= 1000) {
      const m = k / 1000;
      return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2)}M`;
    }
    return `$${k}K`;
  }
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPct(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatHours(n: number): string {
  return `${Math.round(n).toLocaleString()}h`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, 1));
  const shortMonth = date.toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  return `${shortMonth} ’${String(y).slice(-2)}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRelativeDays(iso: string, today = new Date()): string {
  const d = new Date(iso);
  const days = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days > 0 && days < 30) return `${days}d ago`;
  if (days < 0 && days > -30) return `in ${-days}d`;
  return formatDate(iso);
}

