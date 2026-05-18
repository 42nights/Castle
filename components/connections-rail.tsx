"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  listConnections,
  type ConnectionRow,
} from "@/app/connections/actions";
import { useActorSlug } from "@/lib/use-actor";

/**
 * Right-rail integration status. Shows the operator's CONNECTED
 * toolkits at a glance; the full catalog (1000+) lives behind the
 * "browse all" link to /connections.
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
    return () =>
      window.removeEventListener("castle:connections-changed", bump);
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
          Pick an actor in the top nav to see your connections.
        </div>
      ) : !loaded ? (
        <div className="px-3 py-3 text-[12px] text-ink-3">Checking…</div>
      ) : connected.length === 0 && pending.length === 0 ? (
        <div className="px-3 py-3 flex flex-col gap-2">
          <p className="text-[12px] text-ink-3 leading-snug">
            Nothing connected yet. Castle works without integrations, but
            it gets a lot more useful with them.
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
              className="px-3 py-2 border-b border-line last:border-b-0 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <StatusGlyph status={r.status} />
                <span className="text-[13px] text-ink truncate">
                  {r.toolkit}
                </span>
              </div>
              <span className="text-[11px] text-ink-3">
                {r.status === "connected" ? "on" : "pending"}
              </span>
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

function StatusGlyph({
  status,
}: {
  status: "connected" | "pending" | "none";
}) {
  if (status === "connected") {
    return (
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-ink text-page text-[10px] leading-none"
        aria-label="connected"
      >
        ✓
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="hp" data-health="yellow" aria-label="pending" />
    );
  }
  return <span className="hp" aria-label="not connected" />;
}
