"use client";

import { useQuery } from "convex/react";
import { useActorSlug } from "@/lib/use-actor";
import { api } from "@/convex/_generated/api";

type FdeLite = { _id?: string; slug: string; name: string };

// v0 fallback so the bar works before Convex is provisioned.
const FALLBACK: FdeLite[] = [
  { slug: "jerry", name: "Jerry X" },
  { slug: "ayaan", name: "Ayaan Gazali" },
];

export function ActorBar() {
  const [actor, setActor] = useActorSlug();
  const live = useQuery(api.fdes.list) as FdeLite[] | undefined;
  const fdes = live ?? FALLBACK;
  const me = fdes.find((f) => f.slug === actor) ?? null;

  return (
    <div className="hidden md:flex items-center gap-2 t-caption text-ink-3">
      <span>you are</span>
      <select
        value={me?.slug ?? ""}
        onChange={(e) => setActor(e.target.value || null)}
        className="h-6 rounded-sm border border-line bg-page px-1.5 text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-ink"
        aria-label="Acting as"
      >
        <option value="">— pick FDE —</option>
        {fdes.map((f) => (
          <option key={f.slug} value={f.slug}>
            {f.name}
          </option>
        ))}
      </select>
    </div>
  );
}
