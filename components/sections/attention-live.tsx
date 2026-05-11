"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/atoms";
import { TouchedButton } from "@/components/controls/touched-button";
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

const sevLabel: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Watch",
};

function useNowBucket() {
  const [b, setB] = useState(() => Math.floor(Date.now() / 60_000));
  useEffect(() => {
    const id = setInterval(() => setB(Math.floor(Date.now() / 60_000)), 60_000);
    return () => clearInterval(id);
  }, []);
  return b;
}

export function AttentionListLive() {
  const nowBucket = useNowBucket();
  const items = useQuery(api.attention.list, { nowBucket }) as
    | LiveItem[]
    | undefined;
  const fdes = useQuery(api.fdes.list) as
    | Array<{ _id: string; name: string }>
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
      <section className="mb-14 border border-line rounded-md p-6 bg-surface">
        <div className="t-eyebrow mb-2">— What needs you today</div>
        <p className="text-ink-2 text-[14px]">Loading…</p>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="mb-14 border border-line rounded-md p-6 bg-surface">
        <div className="t-eyebrow mb-2">— What needs you today</div>
        <p className="text-ink-2 text-[14px]">
          Nothing flagged. Everything green, no engagement stale beyond 7 days.
        </p>
      </section>
    );
  }

  const counts = items.reduce<Record<Severity, number>>(
    (acc, i) => ({ ...acc, [i.severity]: (acc[i.severity] ?? 0) + 1 }),
    { critical: 0, high: 0, medium: 0 },
  );
  const fdeById = new Map((fdes ?? []).map((f) => [f._id, f]));
  const engagementSlugById = new Map(
    (engagementsList ?? []).map((e) => [e._id, e.slug]),
  );

  return (
    <section className="mb-14">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="t-eyebrow mb-2">— What needs you today</div>
          <h2 className="t-h2 text-ink">Operator queue.</h2>
        </div>
        <div className="t-caption flex items-center gap-3">
          {counts.critical > 0 && <Badge severity="critical" count={counts.critical} />}
          {counts.high > 0 && <Badge severity="high" count={counts.high} />}
          {counts.medium > 0 && <Badge severity="medium" count={counts.medium} />}
        </div>
      </div>

      <ul className="border-t border-line">
        {items.map((item) => {
          const owner = item.owner_fde_id
            ? fdeById.get(item.owner_fde_id)
            : null;
          const engagementSlug = item.related_engagement_id
            ? engagementSlugById.get(item.related_engagement_id)
            : null;
          const showTouch =
            engagementSlug &&
            (item.item_key.startsWith("stale-eng:") ||
              item.item_key.startsWith("red-eng:") ||
              item.item_key.startsWith("yellow-eng:"));
          return (
            <li key={item.item_key} className="border-b border-line group">
              <div className="grid grid-cols-[88px_1fr_auto] items-center gap-5 py-4 px-3 -mx-3 rounded-sm hover:bg-surface transition-colors">
                <SeverityChip severity={item.severity} />
                <Link href={item.href} className="min-w-0 block">
                  <div className="text-[14.5px] text-ink leading-tight hover:underline">
                    {item.title}
                  </div>
                  <p className="mt-1 text-[12.5px] text-ink-2 leading-relaxed line-clamp-2">
                    {item.subtitle}
                  </p>
                </Link>
                <div className="flex items-center gap-2">
                  {owner && (
                    <span className="inline-flex items-center gap-2">
                      <Avatar name={owner.name} size={20} />
                      <span className="t-caption">
                        {owner.name.split(" ")[0]}
                      </span>
                    </span>
                  )}
                  {showTouch && engagementSlug && (
                    <TouchedButton engagementSlug={engagementSlug} />
                  )}
                  <button
                    onClick={() => doSnooze(item.item_key, 24)}
                    className="t-caption text-ink-3 hover:text-ink h-6 px-1.5 rounded-sm hover:bg-page"
                    title="Snooze 24h"
                  >
                    24h
                  </button>
                  <button
                    onClick={() => doSnooze(item.item_key, 24 * 7)}
                    className="t-caption text-ink-3 hover:text-ink h-6 px-1.5 rounded-sm hover:bg-page"
                    title="Snooze 7d"
                  >
                    7d
                  </button>
                  <button
                    onClick={() => doResolve(item)}
                    className="t-caption text-ink h-6 px-2 rounded-sm bg-page border border-line hover:bg-surface"
                    title="Resolve"
                  >
                    resolve
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SeverityChip({ severity }: { severity: Severity }) {
  const tone =
    severity === "critical"
      ? "bg-accent text-page"
      : severity === "high"
        ? "bg-ink text-page"
        : "border border-line text-ink-2 bg-page";
  return (
    <span
      className={`inline-flex h-5 w-fit items-center rounded-sm px-1.5 uppercase tracking-[0.08em] font-medium text-[10px] ${tone}`}
    >
      {sevLabel[severity]}
    </span>
  );
}

function Badge({ severity, count }: { severity: Severity; count: number }) {
  const dot =
    severity === "critical"
      ? "bg-accent"
      : severity === "high"
        ? "bg-ink"
        : "bg-ink-3";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="num text-ink">{count}</span>
      <span className="text-ink-3">{sevLabel[severity].toLowerCase()}</span>
    </span>
  );
}
