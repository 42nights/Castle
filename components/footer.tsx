// Footer — quiet status bar.
// Version string + a status dot. text-ink-3, border-t border-line.
// Server component — no interactivity needed.

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";

export function Footer() {
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto flex h-10 max-w-[1280px] items-center justify-between px-6 md:px-8">
        <div className="flex items-center gap-2">
          {/* Status dot — always green at build time; swap to a real signal if needed */}
          <span
            aria-label="System status: operational"
            title="All systems operational"
            className="inline-block w-1.5 h-1.5 rounded-full bg-health-good shrink-0"
          />
          <span className="t-caption text-ink-3">Operational</span>
        </div>

        <span className="font-mono text-[11px] text-ink-4">
          v{VERSION}
        </span>
      </div>
    </footer>
  );
}
