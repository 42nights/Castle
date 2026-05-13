"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useRunMutation } from "@/lib/use-run-mutation";
import { useSyncedDraft } from "@/lib/use-synced-draft";

type DeploymentId = string;

function NumInline({
  id,
  field,
  current,
  step,
  min,
  max,
  width,
  suffix,
  label,
  format,
}: {
  id: DeploymentId;
  field: "hours_replaced_per_week" | "customization_pct";
  current: number;
  step: number;
  min: number;
  max?: number;
  width: string;
  suffix: string;
  label: string;
  format: (v: number) => string;
}) {
  const run = useRunMutation(api.deployments.update);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft, resetDraft] = useSyncedDraft(current, editing);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    if (draft === current) return;
    if (draft < min || (max !== undefined && draft > max)) {
      toast.error(
        max !== undefined
          ? `${label} must be ${min}–${max}`
          : `${label} must be ≥ ${min}`,
      );
      resetDraft();
      return;
    }
    await run(
      {
        id: id as never,
        patch: { [field]: draft } as never,
      },
      { success: `${label} → ${format(draft)}` },
    );
  };

  if (!editing) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        className="num text-ink-2 hover:text-ink hover:bg-surface rounded-sm px-1 text-[12px]"
        title={`Click to edit ${label.toLowerCase()}`}
      >
        {format(current)}
        {suffix}
      </button>
    );
  }
  return (
    <input
      ref={ref}
      type="number"
      step={step}
      min={min}
      max={max}
      value={draft}
      onChange={(e) => setDraft(Number(e.target.value) || 0)}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === "Escape") {
          resetDraft();
          setEditing(false);
        }
      }}
      className={`num h-6 ${width} rounded-sm border border-ink bg-page px-1.5 text-ink text-[12.5px] focus:outline-none`}
    />
  );
}

export function DeploymentHoursInput({
  deploymentId,
  current,
}: {
  deploymentId: DeploymentId;
  current: number;
}) {
  return (
    <NumInline
      id={deploymentId}
      field="hours_replaced_per_week"
      current={current}
      step={1}
      min={0}
      width="w-14"
      suffix="h"
      label="Hrs/wk"
      format={(v) => String(v)}
    />
  );
}

export function DeploymentCustomPctInput({
  deploymentId,
  current,
}: {
  deploymentId: DeploymentId;
  current: number;
}) {
  return (
    <NumInline
      id={deploymentId}
      field="customization_pct"
      current={current}
      step={5}
      min={0}
      max={100}
      width="w-14"
      suffix="%"
      label="Custom"
      format={(v) => String(v)}
    />
  );
}
