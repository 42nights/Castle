"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { listConnections, type ConnectionRow } from "@/app/connections/actions";
import { useActorSlug } from "@/lib/use-actor";

/**
 * Right-rail integration status. Shows the operator's CONNECTED
 * toolkits at a glance; the full catalog (1000+) lives behind the
 * "browse all" link to /connections. Each row renders the toolkit's
 * real logo on the left and a status icon (filled check vs. pulsing
 * dot) on the right.
 */
export function ConnectionsRail() {
  const [actorSlug] = useActorSlug();
  const [rows, setRows] = useState<ConnectionRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!actorSlug) {
      setLoaded(true);
      setRows([]);
      return;
    }
    setLoaded(false);
    setRows([]);
    let cancelled = false;
    listConnections(actorSlug).then((r) => {
      if (!cancelled) {
        setRows(r);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [actorSlug, refreshKey]);

  useEffect(() => {
    // Re-fetch when other parts of the UI mutate connection state
    // (e.g. dismissing a chat CTA cancels the INITIATED Composio
    // connection). Otherwise the `pending` row would linger until the
    // next actor change or full page reload.
    const bump = () => setRefreshKey((k) => k + 1);
    window.addEventListener("castle:connections-changed", bump);
    return () => window.removeEventListener("castle:connections-changed", bump);
  }, []);

  const connected = rows.filter((r) => r.status === "connected");
  const pending = rows.filter((r) => r.status === "pending");

  return (
    <aside className="hidden md:flex shrink-0 w-[240px] border-l border-line flex-col">
      <header className="panel-header">
        <div className="flex items-baseline gap-2">
          <h2 className="t-h2 text-ink">Integrations</h2>
          <span className="t-caption num">{connected.length}</span>
        </div>
        <Link
          href="/connections"
          className="text-[11px] text-ink-3 hover:text-ink"
        >
          browse all →
        </Link>
      </header>

      {!actorSlug ? (
        <div className="px-3 py-3 text-[12px] text-ink-3 leading-snug">
          Sign in to see your connections.
        </div>
      ) : !loaded ? (
        <div className="px-3 py-3 text-[12px] text-ink-3">Checking…</div>
      ) : connected.length === 0 && pending.length === 0 ? (
        <div className="px-3 py-3 flex flex-col gap-2">
          <p className="text-[12px] text-ink-3 leading-snug">
            Nothing connected yet. Castle works without integrations, but it
            gets a lot more useful with them.
          </p>
          <Link
            href="/connections"
            className="text-[11.5px] text-ink hover:underline underline-offset-2 decoration-line"
          >
            connect a service →
          </Link>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {[...connected, ...pending].map((r) => (
            <li
              key={r.toolkit}
              className="px-3 py-2 border-b border-line last:border-b-0 flex items-center gap-2.5"
            >
              <ToolkitLogo logo={r.logo} slug={r.toolkit} />
              <span className="flex-1 min-w-0 text-[13px] text-ink truncate">
                {r.name ?? r.toolkit}
              </span>
              <StatusIcon status={r.status} />
            </li>
          ))}
        </ul>
      )}

      {actorSlug && loaded && (connected.length > 0 || pending.length > 0) && (
        <div className="border-t border-line px-3 py-2">
          <Link
            href="/connections"
            className="text-[11.5px] text-ink-2 hover:text-ink"
          >
            + add another
          </Link>
        </div>
      )}
    </aside>
  );
}

function ToolkitLogo({ logo, slug }: { logo?: string; slug: string }) {
  const [errored, setErrored] = useState(false);
  if (logo && !errored) {
    return (
      <span className="inline-flex shrink-0 h-5 w-5 items-center justify-center rounded-sm bg-page border border-line overflow-hidden">
        <Image
          src={logo}
          alt=""
          width={20}
          height={20}
          className="object-contain"
          onError={() => setErrored(true)}
          unoptimized
        />
      </span>
    );
  }
  // Fallback: first letter of slug in a neutral chip.
  return (
    <span
      className="inline-flex shrink-0 h-5 w-5 items-center justify-center rounded-sm bg-surface border border-line text-[10px] text-ink-2 uppercase"
      aria-hidden="true"
    >
      {slug.charAt(0)}
    </span>
  );
}

function StatusIcon({ status }: { status: "connected" | "pending" | "none" }) {
  if (status === "connected") {
    return (
      <svg
        viewBox="0 0 12 12"
        className="size-3.5 text-ink"
        aria-label="connected"
      >
        <circle cx="6" cy="6" r="5" fill="currentColor" />
        <path
          d="M3.5 6.3L5.2 8L8.5 4.6"
          stroke="var(--color-page, white)"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (status === "pending") {
    return (
      <span
        className="relative inline-flex size-3 items-center justify-center"
        aria-label="pending"
      >
        <span className="absolute inset-0 rounded-full bg-yellow-500/30 animate-ping" />
        <span className="relative size-2 rounded-full bg-yellow-500" />
      </span>
    );
  }
  return (
    <span
      className="inline-block size-2 rounded-full border border-line"
      aria-label="not connected"
    />
  );
}
