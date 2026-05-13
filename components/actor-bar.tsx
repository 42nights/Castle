"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { useActorSlug } from "@/lib/use-actor";
import { api } from "@/convex/_generated/api";

type FdeLite = { _id?: string; slug: string; name: string };

// v0 fallback so the bar works before Convex is provisioned.
const FALLBACK: FdeLite[] = [
  { slug: "jerry", name: "Jerry X" },
  { slug: "ayaan", name: "Ayaan Gazali" },
];

/**
 * Custom trigger + popover instead of a native <select>. Native selects
 * render OS-chrome that breaks the design — particularly noticeable in
 * the top nav. Custom keeps everything in the system's voice.
 */
export function ActorBar() {
  const [actor, setActor] = useActorSlug();
  const live = useQuery(api.fdes.list) as FdeLite[] | undefined;
  const fdes = live ?? FALLBACK;
  const me = fdes.find((f) => f.slug === actor) ?? null;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div
      ref={ref}
      className="hidden md:flex items-baseline gap-2 text-[11px] text-ink-3 relative"
    >
      <span>as</span>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-[12px] text-ink hover:text-ink-2 underline underline-offset-4 decoration-line"
      >
        {me ? me.name.split(" ")[0] : "pick"}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-44 rounded-md border border-line bg-page shadow-[0_8px_24px_-12px_rgba(10,10,10,0.18)] py-1">
          {fdes.map((f) => {
            const isMe = f.slug === me?.slug;
            return (
              <button
                key={f.slug}
                onClick={() => {
                  setActor(f.slug);
                  setOpen(false);
                }}
                className={`block w-full text-left px-3 py-1.5 text-[13px] ${
                  isMe
                    ? "text-ink bg-surface"
                    : "text-ink-2 hover:text-ink hover:bg-surface"
                }`}
              >
                {f.name}
              </button>
            );
          })}
          {me && (
            <button
              onClick={() => {
                setActor(null);
                setOpen(false);
              }}
              className="block w-full text-left px-3 py-1.5 text-[12px] text-ink-3 hover:text-ink hover:bg-surface border-t border-line"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
