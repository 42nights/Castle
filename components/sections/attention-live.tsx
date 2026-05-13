"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";

type Severity = "critical" | "high" | "medium";

type LiveItem = {
  item_key: string;
  severity: Severity;
  title: string;
  subtitle: string;
  owner_fde_id: string | null;
  related_engagement_id: string | null;
  href: string;
  source: "derived" | "manual";
  manual_id?: string;
};

function useNowBucket() {
  const [b, setB] = useState(() => Math.floor(Date.now() / 60_000));
  useEffect(() => {
    const id = setInterval(() => setB(Math.floor(Date.now() / 60_000)), 60_000);
    return () => clearInterval(id);
  }, []);
  return b;
}

/**
 * Operator queue.
 *
 * Layout choices:
 * - No surrounding card. Section sits directly on the page.
 * - Ledger rows: single hairline between rows, no row borders.
 * - The pip IS the severity. Critical = red. High = ink. Medium = ink-3.
 *   No "Critical/High/Watch" text label competing with the title.
 * - One always-visible action ("touched" — only when relevant). Snooze and
 *   resolve live behind a hover-revealed kebab so they don't fight the
 *   title for attention.
 * - Owner avatar dropped from the rest state (it lives on the engagement
 *   page). Cuts a column of noise.
 */
export function AttentionListLive() {
  const nowBucket = useNowBucket();
  const items = useQuery(api.attention.list, { nowBucket }) as
    | LiveItem[]
    | undefined;
  const engagementsList = useQuery(api.engagements.list) as
    | Array<{ _id: string; slug: string }>
    | undefined;

  const [actorSlug] = useActorSlug();
  const actor = useQuery(
    api.fdes.getBySlug,
    actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const snooze = useRunMutation(api.attention.snooze);
  const resolve = useRunMutation(api.attention.resolve);
  const resolveManual = useRunMutation(api.attention.resolveManualItem);

  const doSnooze = useCallback(
    async (item_key: string, durationHours: number) => {
      if (!actor) return;
      const until = new Date(
        Date.now() + durationHours * 3_600_000,
      ).toISOString();
      await snooze(
        {
          item_key,
          until,
          reason: "snoozed",
          actor_fde_id: actor._id as never,
        },
        {
          success:
            durationHours < 24 ? "Snoozed" : `Snoozed ${durationHours / 24}d`,
        },
      );
    },
    [actor, snooze],
  );

  const doResolve = useCallback(
    async (item: LiveItem) => {
      if (!actor) return;
      if (item.source === "manual" && item.manual_id) {
        await resolveManual(
          { id: item.manual_id as never, actor_fde_id: actor._id as never },
          { success: "Resolved" },
        );
      } else {
        await resolve(
          { item_key: item.item_key, actor_fde_id: actor._id as never },
          { success: "Resolved" },
        );
      }
    },
    [actor, resolve, resolveManual],
  );

  if (items === undefined) {
    return (
      <section className="panel mb-4">
        <header className="panel-header">
          <h2 className="t-h2 text-ink">Today</h2>
        </header>
        <p className="px-3 py-3 text-ink-3 text-[12px]">Loading…</p>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="panel mb-4">
        <header className="panel-header">
          <h2 className="t-h2 text-ink">Today</h2>
        </header>
        <p className="px-3 py-3 text-ink-2 text-[13px] leading-snug">
          Nothing flagged. All green, nothing stale &gt; 7d.
        </p>
      </section>
    );
  }

  const counts = items.reduce<Record<Severity, number>>(
    (acc, i) => ({ ...acc, [i.severity]: (acc[i.severity] ?? 0) + 1 }),
    { critical: 0, high: 0, medium: 0 },
  );
  const engagementSlugById = new Map(
    (engagementsList ?? []).map((e) => [e._id, e.slug]),
  );

  return (
    <section className="panel mb-4">
      <header className="panel-header">
        <h2 className="t-h2 text-ink">Today</h2>
        <div className="text-[11px] text-ink-3 flex items-baseline gap-4 num">
          {counts.critical > 0 && (
            <span className="inline-flex items-baseline gap-1.5">
              <span className="hp" data-health="red" /> {counts.critical}
            </span>
          )}
          {counts.high > 0 && (
            <span className="inline-flex items-baseline gap-1.5">
              <span className="hp" data-health="yellow" /> {counts.high}
            </span>
          )}
          {counts.medium > 0 && (
            <span className="inline-flex items-baseline gap-1.5">
              <span className="hp" /> {counts.medium}
            </span>
          )}
        </div>
      </header>

      <ol className="ledger">
        {items.map((item) => {
          const engagementSlug = item.related_engagement_id
            ? engagementSlugById.get(item.related_engagement_id)
            : null;
          const showTouch =
            !!engagementSlug &&
            (item.item_key.startsWith("stale-eng:") ||
              item.item_key.startsWith("red-eng:") ||
              item.item_key.startsWith("yellow-eng:"));
          const sevPip =
            item.severity === "critical"
              ? "red"
              : item.severity === "high"
                ? "yellow"
                : undefined;
          return (
            <QueueRow
              key={item.item_key}
              title={item.title}
              subtitle={item.subtitle}
              href={item.href}
              sevPip={sevPip}
              engagementSlug={showTouch ? engagementSlug! : undefined}
              onSnooze={(hours) => doSnooze(item.item_key, hours)}
              onResolve={() => doResolve(item)}
            />
          );
        })}
      </ol>
    </section>
  );
}

/** Single queue row. Hover reveals snooze/resolve; touched is always shown
 *  when relevant since it's the single most-frequent action. */
function QueueRow({
  title,
  subtitle,
  href,
  sevPip,
  engagementSlug,
  onSnooze,
  onResolve,
}: {
  title: string;
  subtitle: string;
  href: string;
  sevPip?: "red" | "yellow";
  engagementSlug?: string;
  onSnooze: (hours: number) => void;
  onResolve: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <li
      ref={ref}
      className="group relative grid grid-cols-[16px_1fr_auto] items-baseline gap-3 py-2 px-3 hover:bg-surface"
    >
      <span
        className="hp self-center"
        data-health={sevPip ?? undefined}
        aria-hidden
      />
      <Link href={href} className="min-w-0 block">
        <div className="text-[15px] text-ink leading-snug">{title}</div>
        <p className="mt-1 text-[13px] text-ink-2 leading-relaxed line-clamp-1">
          {subtitle}
        </p>
      </Link>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {engagementSlug && <TouchedQuick slug={engagementSlug} />}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="h-6 w-6 rounded-sm text-ink-3 hover:text-ink hover:bg-page text-[14px] leading-none flex items-center justify-center"
          aria-label="More actions"
        >
          ⋯
        </button>
      </div>

      {menuOpen && (
        <div className="absolute right-3 top-full z-10 mt-1 w-44 rounded-md border border-line bg-page shadow-[0_8px_24px_-12px_rgba(10,10,10,0.18)] py-1 text-[13px]">
          <button
            onClick={() => {
              onSnooze(24);
              setMenuOpen(false);
            }}
            className="block w-full text-left px-3 py-1.5 text-ink-2 hover:text-ink hover:bg-surface"
          >
            Snooze 24h
          </button>
          <button
            onClick={() => {
              onSnooze(24 * 7);
              setMenuOpen(false);
            }}
            className="block w-full text-left px-3 py-1.5 text-ink-2 hover:text-ink hover:bg-surface"
          >
            Snooze 7d
          </button>
          <button
            onClick={() => {
              onResolve();
              setMenuOpen(false);
            }}
            className="block w-full text-left px-3 py-1.5 text-ink-2 hover:text-ink hover:bg-surface"
          >
            Resolve
          </button>
        </div>
      )}
    </li>
  );
}

/** Tiny inline "touched" affordance — text only, no chrome. */
function TouchedQuick({ slug }: { slug: string }) {
  // Reuse the existing TouchedButton's logic but render as a text link.
  // Importing the component would keep the pill styling, so inline the
  // small piece we need here.
  const [actorSlug] = useActorSlug();
  const eng = useQuery(api.engagements.getBySlug, { slug }) as
    | { _id: string }
    | null
    | undefined;
  const actorFde = useQuery(
    api.fdes.getBySlug,
    actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const run = useRunMutation(api.engagements.markTouched);
  const [pending, setPending] = useState(false);

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!eng || !actorFde) return;
    setPending(true);
    await run(
      { id: eng._id as never, actor_fde_id: actorFde._id as never },
      { success: "Marked updated" },
    );
    setPending(false);
  };

  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="text-[12px] text-ink-2 hover:text-ink disabled:opacity-50"
    >
      {pending ? "saving…" : "touched today"}
    </button>
  );
}
