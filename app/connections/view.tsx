"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useActorSlug } from "@/lib/use-actor";
import {
  disconnect,
  initiateConnection,
  listConnections,
  type ConnectionRow,
  type ConnectionStatus,
  type Toolkit,
} from "./actions";

export function ConnectionsView({
  configured,
  toolkits,
  justReturned,
}: {
  configured: boolean;
  toolkits: Toolkit[];
  justReturned: boolean;
}) {
  const [actorSlug] = useActorSlug();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("");
  const [onlyManaged, setOnlyManaged] = useState(true);
  const [onlyConnected, setOnlyConnected] = useState(false);

  useEffect(() => {
    if (!configured || !actorSlug) return;
    setLoading(true);
    listConnections(actorSlug)
      .then((r) => setConnections(r))
      .finally(() => setLoading(false));
  }, [configured, actorSlug, justReturned]);

  // After an OAuth return, sweep any open chat CTAs for this actor.
  const dismissAll = useMutation(api.agentActions.dismissAllForActor);
  useEffect(() => {
    if (!justReturned || !actorSlug) return;
    dismissAll({ actor_slug: actorSlug }).catch(() => {});
  }, [justReturned, actorSlug, dismissAll]);

  const statusBySlug = useMemo(() => {
    const m = new Map<string, { status: ConnectionStatus; id: string | null }>();
    for (const c of connections)
      m.set(c.toolkit, { status: c.status, id: c.connectedAccountId });
    return m;
  }, [connections]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of toolkits) set.add(t.category);
    return Array.from(set).sort();
  }, [toolkits]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return toolkits
      .filter((t) => !onlyManaged || t.managed || t.noAuth)
      .filter((t) => !cat || t.category === cat)
      .filter(
        (t) =>
          !query ||
          t.slug.includes(query) ||
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query),
      )
      .filter((t) => {
        if (!onlyConnected) return true;
        return statusBySlug.get(t.slug)?.status === "connected";
      })
      .sort((a, b) => {
        // Connected first, then alphabetical
        const ac = statusBySlug.get(a.slug)?.status === "connected" ? 0 : 1;
        const bc = statusBySlug.get(b.slug)?.status === "connected" ? 0 : 1;
        if (ac !== bc) return ac - bc;
        return a.name.localeCompare(b.name);
      });
  }, [toolkits, q, cat, onlyManaged, onlyConnected, statusBySlug]);

  const connectedCount = connections.filter(
    (c) => c.status === "connected",
  ).length;

  const connect = (slug: string) => {
    if (!actorSlug) {
      toast.error("Pick an actor FDE in the top nav first.");
      return;
    }
    setBusy(slug);
    startTransition(async () => {
      const res = await initiateConnection(slug, actorSlug);
      setBusy(null);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      if (!res.redirectUrl) {
        toast.error("No redirect URL returned.");
        return;
      }
      window.location.href = res.redirectUrl;
    });
  };

  const disco = (slug: string, id: string) => {
    if (!confirm(`Disconnect ${slug}?`)) return;
    setBusy(slug);
    startTransition(async () => {
      const res = await disconnect(id);
      setBusy(null);
      if (!res.ok) {
        toast.error(res.error ?? "Disconnect failed.");
        return;
      }
      toast.success(`${slug} disconnected.`);
      if (actorSlug) {
        const next = await listConnections(actorSlug);
        setConnections(next);
      }
      router.refresh();
    });
  };

  return (
    <>
      {justReturned && (
        <div className="panel mb-4">
          <header className="panel-header">
            <h2 className="t-h2 text-ink">Connection complete</h2>
          </header>
          <p className="px-3 py-2 text-[12.5px] text-ink-2">
            Composio confirmed the OAuth grant. Tools are now live in chat.
          </p>
        </div>
      )}

      <section className="panel mb-4">
        <header className="panel-header">
          <div className="flex items-baseline gap-3">
            <h2 className="t-h2 text-ink">Catalog</h2>
            <span className="t-caption num">
              {actorSlug ? `${connectedCount} connected · ` : ""}
              {filtered.length}/{toolkits.length}
            </span>
          </div>
          <span className="t-caption">
            {actorSlug
              ? `as ${actorSlug}${loading ? " · syncing" : ""}`
              : "pick an actor"}
          </span>
        </header>

        <div className="px-3 py-2 border-b border-line flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search 1000+ services…"
            className="h-7 flex-1 min-w-[200px] rounded-sm border border-line bg-page px-2 text-[12.5px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-ink-2"
          />
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="h-7 rounded-sm border border-line bg-page px-2 text-[12px] text-ink-2 focus:outline-none focus:border-ink-2"
          >
            <option value="">all categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1.5 text-[12px] text-ink-2 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyManaged}
              onChange={(e) => setOnlyManaged(e.target.checked)}
              className="accent-ink"
            />
            one-click only
          </label>
          <label className="inline-flex items-center gap-1.5 text-[12px] text-ink-2 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyConnected}
              onChange={(e) => setOnlyConnected(e.target.checked)}
              className="accent-ink"
            />
            connected only
          </label>
        </div>

        {filtered.length === 0 ? (
          <p className="px-3 py-3 text-ink-3 text-[12px]">
            No services match.
          </p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-x divide-line">
            {filtered.map((t) => {
              const s = statusBySlug.get(t.slug);
              const isConnected = s?.status === "connected";
              const isPending = s?.status === "pending";
              return (
                <li
                  key={t.slug}
                  className="px-3 py-2 border-b border-line flex items-start justify-between gap-3 hover:bg-surface"
                >
                  <div className="min-w-0 flex items-start gap-2">
                    <Status status={s?.status ?? "none"} />
                    <div className="min-w-0">
                      <div className="text-[13.5px] text-ink truncate">
                        {t.name}
                      </div>
                      <div className="text-[11px] text-ink-3 truncate">
                        {t.category}
                        {!t.managed && !t.noAuth && (
                          <span className="ml-1.5 text-ink-3">
                            · byo-auth
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isConnected && s?.id ? (
                    <button
                      onClick={() => disco(t.slug, s.id as string)}
                      disabled={pending || !configured}
                      className="text-[11px] text-ink-3 hover:text-accent underline underline-offset-2 decoration-line shrink-0"
                    >
                      disconnect
                    </button>
                  ) : t.noAuth ? (
                    <span className="text-[11px] text-ink-3">no auth</span>
                  ) : (
                    <button
                      onClick={() => connect(t.slug)}
                      disabled={
                        pending ||
                        !configured ||
                        !actorSlug ||
                        (!t.managed && !t.noAuth)
                      }
                      className="h-6 px-2 rounded-sm bg-ink text-page text-[11px] disabled:opacity-40 shrink-0"
                      title={
                        !t.managed && !t.noAuth
                          ? "Requires bringing your own OAuth app — set it up in Composio dashboard"
                          : undefined
                      }
                    >
                      {busy === t.slug
                        ? "…"
                        : isPending
                          ? "retry"
                          : "connect"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function Status({ status }: { status: ConnectionStatus }) {
  if (status === "connected") {
    return (
      <span
        className="mt-[2px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-ink text-page text-[10px] leading-none shrink-0"
        aria-label="connected"
      >
        ✓
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span
        className="mt-[6px] hp shrink-0"
        data-health="yellow"
        aria-label="pending"
      />
    );
  }
  return <span className="mt-[6px] hp shrink-0" aria-label="not connected" />;
}
