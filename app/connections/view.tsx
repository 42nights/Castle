"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useActorSlug } from "@/lib/use-actor";
import { Button } from "@/components/ui/button";
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    <div className="space-y-4">
      {/* OAuth return confirmation */}
      {justReturned && (
        <div
          role="alert"
          className="rounded-md bg-health-soft-good px-4 py-3 text-[13px] text-health-good border border-health-good/20"
        >
          <span className="font-medium text-ink">Connection complete.</span>{" "}
          Composio confirmed the OAuth grant. Tools are now live in chat.
        </div>
      )}

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
            aria-hidden="true"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search services…"
            aria-label="Search toolkit catalog"
            className="h-9 w-full rounded-sm border border-line bg-canvas pl-8 pr-3 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-line-strong focus:shadow-[var(--shadow-focus)] transition-[border-color,box-shadow]"
          />
        </div>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          aria-label="Filter by category"
          className="h-9 rounded-sm border border-line bg-canvas px-2 pr-7 text-[13px] text-ink-2 focus:outline-none focus:border-line-strong focus:shadow-[var(--shadow-focus)] transition-[border-color,box-shadow]"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyManaged}
            onChange={(e) => setOnlyManaged(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          One-click only
        </label>
        <label className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyConnected}
            onChange={(e) => setOnlyConnected(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          Connected only
        </label>

        {/* Status summary */}
        {actorSlug && (
          <span className="t-caption text-ink-3 ml-auto">
            {connectedCount > 0 ? `${connectedCount} connected · ` : ""}
            {filtered.length}/{toolkits.length}{loading ? " · syncing" : ""}
          </span>
        )}
        {!actorSlug && (
          <span className="t-caption text-ink-3 ml-auto">
            Pick an actor in the top nav to see connection status
          </span>
        )}
      </div>

      {/* Toolkit grid */}
      {filtered.length === 0 ? (
        <div className="rounded-md bg-canvas shadow-[var(--shadow-base)] px-6 py-10 text-center">
          <p className="text-[14px] text-ink-3">No services match your search.</p>
        </div>
      ) : (
        <ul
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
          aria-label="Toolkit catalog"
        >
          {filtered.map((t) => {
            const s = statusBySlug.get(t.slug);
            const isConnected = s?.status === "connected";
            const isPending = s?.status === "pending";

            return (
              <li
                key={t.slug}
                className={[
                  "group relative rounded-md bg-canvas shadow-[var(--shadow-base)] p-4 flex flex-col gap-3",
                  "transition-[box-shadow,transform] duration-[var(--duration-base)] ease-[var(--ease-out-soft)]",
                  "hover:shadow-[var(--shadow-md)] hover:-translate-y-px",
                  isConnected
                    ? "border-l-[3px] border-l-accent"
                    : "border-l-[3px] border-l-transparent",
                ].join(" ")}
              >
                {/* Header row: logo + name + status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ToolkitLogo logo={t.logo} name={t.name} />
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium text-ink truncate">
                        {t.name}
                      </div>
                      <div className="text-[11px] text-ink-3 truncate">
                        {t.category}
                        {!t.managed && !t.noAuth && (
                          <span className="ml-1 text-ink-4">· custom auth</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status badge */}
                  <StatusBadge status={s?.status ?? "none"} />
                </div>

                {/* Description */}
                {t.description && (
                  <p className="text-[12px] text-ink-2 leading-[1.5] line-clamp-2 flex-1">
                    {t.description}
                  </p>
                )}

                {/* Action button */}
                <div className="flex justify-end">
                  {t.noAuth ? (
                    <span className="text-[12px] text-ink-3">No auth required</span>
                  ) : isConnected && s?.id ? (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => disco(t.slug, s.id as string)}
                      disabled={pending}
                      aria-label={`Disconnect ${t.name}`}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      variant={isConnected ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => connect(t.slug)}
                      disabled={
                        pending ||
                        !configured ||
                        !actorSlug ||
                        (!t.managed && !t.noAuth)
                      }
                      loading={busy === t.slug}
                      aria-label={`Connect ${t.name}`}
                      title={
                        !t.managed && !t.noAuth
                          ? "Requires custom OAuth setup in Composio dashboard"
                          : undefined
                      }
                    >
                      {busy === t.slug
                        ? "Connecting…"
                        : isPending
                          ? "Retry connect"
                          : "Connect"}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ToolkitLogo({ logo, name }: { logo: string; name: string }) {
  const [errored, setErrored] = useState(false);
  const initial = (name[0] ?? "?").toUpperCase();
  const colors = ["bg-chip-deal", "bg-chip-build", "bg-chip-live", "bg-chip-wind"];
  const colorIdx = name.charCodeAt(0) % colors.length;

  if (logo && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={`${name} logo`}
        width={32}
        height={32}
        onError={() => setErrored(true)}
        className="size-8 rounded-sm object-contain shrink-0"
      />
    );
  }

  return (
    <div
      className={`size-8 rounded-sm shrink-0 flex items-center justify-center text-[13px] font-semibold text-ink ${colors[colorIdx]}`}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}

function StatusBadge({ status }: { status: ConnectionStatus | "none" }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-health-good font-medium shrink-0">
        <span className="size-1.5 rounded-full bg-health-good" aria-hidden="true" />
        Connected
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-health-warn font-medium shrink-0">
        <span className="size-1.5 rounded-full bg-health-warn" aria-hidden="true" />
        Pending
      </span>
    );
  }
  return (
    <span className="text-[11px] text-ink-4 shrink-0">Not connected</span>
  );
}
