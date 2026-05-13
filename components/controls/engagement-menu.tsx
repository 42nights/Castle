"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";
import type { EngagementPhase, Health } from "@/lib/types";

const PHASES: EngagementPhase[] = ["discovery", "build", "deployed", "support"];
const HEALTHS: Health[] = ["green", "yellow", "red"];

/**
 * One ⋯ button per engagement. Reveals phase / health / progress /
 * touch / reassign in a single flyout instead of pinning five inline
 * controls to the card. Reduces always-visible chrome to one icon.
 */
export function EngagementMenu({
  engagementSlug,
  currentPhase,
  currentHealth,
  currentProgress,
}: {
  engagementSlug: string;
  currentPhase: EngagementPhase;
  currentHealth: Health;
  currentProgress: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [progressDraft, setProgressDraft] = useState(currentProgress);
  useEffect(() => setProgressDraft(currentProgress), [currentProgress]);
  const [actorSlug] = useActorSlug();
  const eng = useQuery(api.engagements.getBySlug, { slug: engagementSlug }) as
    | { _id: string }
    | null
    | undefined;
  const actor = useQuery(
    api.fdes.getBySlug,
    actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const movePhase = useRunMutation(api.engagements.movePhase);
  const setHealth = useRunMutation(api.engagements.setHealth);
  const setProgress = useRunMutation(api.engagements.setProgress);
  const markTouched = useRunMutation(api.engagements.markTouched);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const guard = () => {
    if (!eng || !actor) {
      toast.error(
        !actor ? "Pick an actor FDE first." : "Engagement not in Convex.",
      );
      return false;
    }
    return true;
  };

  const change = async (
    fn: typeof movePhase | typeof setHealth | typeof setProgress,
    args: object,
    success: string,
  ) => {
    if (!guard()) return;
    await fn(args as never, { success });
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="h-6 w-6 rounded-sm text-ink-3 hover:text-ink hover:bg-page text-[14px] leading-none flex items-center justify-center"
        aria-label="Engagement actions"
      >
        ⋯
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-line bg-page shadow-[0_8px_24px_-12px_rgba(10,10,10,0.18)] py-2 text-[13px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 pb-2 text-[10px] tracking-[0.08em] text-ink-3 uppercase">
            Phase
          </div>
          <div className="px-2 pb-2 flex flex-wrap gap-1">
            {PHASES.map((p) => (
              <button
                key={p}
                onClick={() => {
                  setOpen(false);
                  change(
                    movePhase,
                    {
                      id: eng?._id as never,
                      actor_fde_id: actor?._id as never,
                      phase: p,
                    },
                    `Moved to ${p}`,
                  );
                }}
                className={`h-6 px-2 rounded-sm text-[12px] ${
                  p === currentPhase
                    ? "bg-ink text-page"
                    : "text-ink-2 hover:text-ink hover:bg-surface"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="px-3 pb-2 pt-1 text-[10px] tracking-[0.08em] text-ink-3 uppercase">
            Health
          </div>
          <div className="px-2 pb-2 flex gap-1">
            {HEALTHS.map((h) => (
              <button
                key={h}
                onClick={() => {
                  setOpen(false);
                  change(
                    setHealth,
                    {
                      id: eng?._id as never,
                      actor_fde_id: actor?._id as never,
                      health: h,
                    },
                    `Health → ${h}`,
                  );
                }}
                className={`h-6 px-2 rounded-sm text-[12px] flex items-center gap-1.5 ${
                  h === currentHealth
                    ? "bg-ink text-page"
                    : "text-ink-2 hover:text-ink hover:bg-surface"
                }`}
              >
                <span className="hp" data-health={h === "red" ? "red" : h === "yellow" ? "yellow" : undefined} />
                {h}
              </button>
            ))}
          </div>

          <div className="px-3 pb-2 pt-1 text-[10px] tracking-[0.08em] text-ink-3 uppercase">
            Progress
          </div>
          <div className="px-3 pb-3 flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              value={progressDraft}
              onChange={(e) => setProgressDraft(Number(e.target.value))}
              onPointerUp={() => {
                if (progressDraft === currentProgress) return;
                change(
                  setProgress,
                  {
                    id: eng?._id as never,
                    actor_fde_id: actor?._id as never,
                    pct: progressDraft,
                  },
                  `Progress → ${progressDraft}%`,
                );
              }}
              onKeyUp={() => {
                if (progressDraft === currentProgress) return;
                change(
                  setProgress,
                  {
                    id: eng?._id as never,
                    actor_fde_id: actor?._id as never,
                    pct: progressDraft,
                  },
                  `Progress → ${progressDraft}%`,
                );
              }}
              onBlur={() => {
                if (progressDraft === currentProgress) return;
                change(
                  setProgress,
                  {
                    id: eng?._id as never,
                    actor_fde_id: actor?._id as never,
                    pct: progressDraft,
                  },
                  `Progress → ${progressDraft}%`,
                );
              }}
              className="flex-1 accent-ink h-1"
            />
            <span className="num text-ink-2 text-[11px] w-9 text-right">
              {progressDraft}%
            </span>
          </div>

          <div className="border-t border-line mt-1 pt-1">
            <button
              onClick={() => {
                setOpen(false);
                change(
                  markTouched,
                  {
                    id: eng?._id as never,
                    actor_fde_id: actor?._id as never,
                  },
                  "Marked updated",
                );
              }}
              className="block w-full text-left px-3 py-1.5 text-ink-2 hover:text-ink hover:bg-surface"
            >
              Mark touched today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
