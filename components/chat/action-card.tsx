"use client";

// U5 ActionCard — propose_mutation flow.
// Renders an open action as a confirmation card with Accept / Reject / Dismiss.
// After accept: shows result chip + Undo countdown until undo_until passes.
// Keyboard: Enter = accept, Esc = dismiss (when card is focused).

import { useCallback, useEffect, useRef, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";

type ActionRow = {
  _id: Id<"agent_actions">;
  kind: "composio_connect" | "propose_mutation";
  tool_name?: string;
  verb?: string;
  target?: string;
  reason?: string;
  side_effects?: string[];
  payload_json?: string;
  expires_at?: string;
  resolved_outcome?: "accepted" | "rejected" | "dismissed" | "expired";
  resolved_at?: string;
  undo_until?: string;
  result_json?: string;
};

type Props = {
  action: ActionRow;
  onDismiss: (id: Id<"agent_actions">) => void;
};

type CardState = "open" | "accepting" | "accepted" | "rejecting" | "rejected" | "dismissing" | "expired";

function useCountdown(isoTarget: string | undefined): number {
  const [secsLeft, setSecsLeft] = useState(() => {
    if (!isoTarget) return 0;
    return Math.max(0, Math.ceil((new Date(isoTarget).getTime() - Date.now()) / 1000));
  });
  useEffect(() => {
    if (!isoTarget) return;
    const id = setInterval(() => {
      const s = Math.max(0, Math.ceil((new Date(isoTarget).getTime() - Date.now()) / 1000));
      setSecsLeft(s);
    }, 500);
    return () => clearInterval(id);
  }, [isoTarget]);
  return secsLeft;
}

export function ActionCard({ action, onDismiss }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<CardState>(() => {
    if (action.resolved_outcome === "accepted") return "accepted";
    if (action.resolved_outcome === "rejected") return "rejected";
    if (action.resolved_outcome === "dismissed") return "dismissed" as CardState;
    const now = Date.now();
    if (action.expires_at && new Date(action.expires_at).getTime() < now) return "expired";
    return "open";
  });

  const [result, setResult] = useState<unknown>(() => {
    if (!action.result_json) return undefined;
    try { return JSON.parse(action.result_json); } catch { return undefined; }
  });

  const undoSecsLeft = useCountdown(state === "accepted" ? action.undo_until : undefined);
  const canUndo = state === "accepted" && undoSecsLeft > 0;

  const callAction = useCallback(async (verb: "accept" | "reject" | "dismiss" | "undo") => {
    const res = await fetch(`/api/actions/${verb}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId: action._id }),
    });
    return res.ok ? res.json().catch(() => ({})) : Promise.reject(new Error(`${verb} failed: ${res.status}`));
  }, [action._id]);

  const accept = async () => {
    if (state !== "open") return;
    setState("accepting");
    try {
      const data = await callAction("accept") as { result?: unknown };
      setResult(data?.result);
      setState("accepted");
    } catch {
      setState("open");
    }
  };

  const reject = async () => {
    if (state !== "open") return;
    setState("rejecting");
    try {
      await callAction("reject");
      setState("rejected");
    } catch {
      setState("open");
    }
  };

  const dismiss = async () => {
    if (state !== "open") return;
    setState("dismissing");
    try {
      await callAction("dismiss");
      onDismiss(action._id);
    } catch {
      setState("open");
    }
  };

  const undo = async () => {
    if (!canUndo) return;
    try {
      await callAction("undo");
      setState("open");
      setResult(undefined);
    } catch {
      // undo failed silently — chip disappears when undo_until passes anyway
    }
  };

  // Keyboard: Enter = accept, Esc = dismiss (when the card itself has focus)
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== cardRef.current) return;
    if (e.key === "Enter" && state === "open") { e.preventDefault(); void accept(); }
    if (e.key === "Escape" && state === "open") { e.preventDefault(); void dismiss(); }
  };

  // Reuse the countdown hook to drive expiry reactively — secsLeft=0 means expired.
  const expiresCountdown = useCountdown(state === "open" ? action.expires_at : undefined);
  const isExpired = state === "expired" || (state === "open" && action.expires_at != null && expiresCountdown === 0);

  const verb = action.verb ?? action.tool_name?.replace(/_/g, " ") ?? "Action";
  const target = action.target ?? "";
  const reason = action.reason ?? "";
  const sideEffects = action.side_effects ?? [];

  const resultText = (() => {
    if (result === undefined) return "";
    if (typeof result === "string") return result;
    if (result && typeof result === "object") {
      const r = result as Record<string, unknown>;
      return String(r.message ?? r.result ?? r.status ?? "");
    }
    return "";
  })();

  // Accepted — show compact result row + optional undo chip
  if (state === "accepted" || state === "rejected") {
    const accepted = state === "accepted";
    return (
      <div className="flex items-center gap-2 flex-wrap mt-1">
        <span className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-sm border text-[11.5px] ${
          accepted
            ? "border-[var(--color-ribbon-done)]/30 bg-[var(--color-ribbon-done)]/10 text-ok"
            : "border-line bg-surface text-ink-3"
        }`}>
          {accepted ? "✓" : "✗"}
          <span>{verb}{target ? ` · ${target}` : ""}</span>
          {resultText && <span className="opacity-60">— {resultText}</span>}
        </span>
        {canUndo && (
          <button
            onClick={undo}
            className="inline-flex items-center gap-1 h-6 px-2 rounded-sm border border-line bg-page text-[11px] text-ink-3 hover:text-ink hover:border-line-strong transition-colors num"
            title="Undo this action"
          >
            undo <span className="opacity-60">{undoSecsLeft}s</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      tabIndex={state === "open" ? 0 : -1}
      onKeyDown={onKeyDown}
      className={`rounded-sm border ${
        isExpired ? "border-line opacity-50" : "border-line-strong"
      } bg-surface overflow-hidden focus:outline-none focus-visible:ring-1 focus-visible:ring-ink`}
      aria-label={`Proposed action: ${verb}${target ? ` ${target}` : ""}`}
    >
      {/* Header */}
      <div className="px-3 pt-2.5 pb-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-ink leading-snug">
              {verb}
              {target && <span className="text-ink-2"> · {target}</span>}
            </p>
            {reason && (
              <p className="mt-0.5 text-[12px] text-ink-3 leading-snug">{reason}</p>
            )}
          </div>
          {isExpired && (
            <span className="text-[10px] uppercase tracking-wider text-ink-3 shrink-0 mt-0.5">
              expired
            </span>
          )}
        </div>
        {sideEffects.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {sideEffects.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11.5px] text-ink-2">
                <span className="text-ink-3 mt-px shrink-0">·</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Actions */}
      {!isExpired && state !== "dismissing" && (
        <div className="flex items-center gap-2 px-3 pb-2.5 pt-1 border-t border-line mt-1">
          <button
            onClick={accept}
            disabled={state !== "open"}
            className="h-7 px-3 rounded-sm bg-ink text-page text-[12px] disabled:opacity-40 hover:opacity-90 transition-opacity"
            aria-label="Accept this action"
          >
            {state === "accepting" ? "accepting…" : "accept"}
          </button>
          <button
            onClick={reject}
            disabled={state !== "open"}
            className="h-7 px-3 rounded-sm border border-line text-[12px] text-ink-2 hover:text-ink disabled:opacity-40 transition-colors"
            aria-label="Reject this action"
          >
            {state === "rejecting" ? "rejecting…" : "reject"}
          </button>
          <button
            onClick={dismiss}
            disabled={state !== "open"}
            className="h-7 px-2 text-[12px] text-ink-3 hover:text-ink disabled:opacity-40 ml-auto"
            aria-label="Dismiss this action"
          >
            dismiss
          </button>
        </div>
      )}
    </div>
  );
}

// Skeleton while the action list is loading
export function ActionCardSkeleton() {
  return (
    <div className="rounded-sm border border-line bg-surface p-3 animate-pulse">
      <div className="h-3 w-40 rounded bg-surface-2 mb-1.5" />
      <div className="h-2.5 w-56 rounded bg-surface-2" />
      <div className="mt-3 flex gap-2">
        <div className="h-7 w-16 rounded-sm bg-surface-2" />
        <div className="h-7 w-16 rounded-sm bg-surface-2" />
      </div>
    </div>
  );
}
