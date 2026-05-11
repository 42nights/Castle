"use client";

import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogButton,
  DialogField,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";

export function ReassignEngagementDialog({
  open,
  onClose,
  engagementSlug,
}: {
  open: boolean;
  onClose: () => void;
  engagementSlug: string;
}) {
  const eng = useQuery(api.engagements.getBySlug, { slug: engagementSlug }) as
    | { _id: string }
    | null
    | undefined;
  const fdes = useQuery(api.fdes.list) as
    | Array<{ _id: string; name: string }>
    | undefined;
  const assignments = useQuery(
    api.engagements.listAssignments,
    eng ? { engagement_id: eng._id as never } : "skip",
  ) as
    | Array<{ fde_id: string; removed_at: string | null }>
    | undefined;
  const [actorSlug] = useActorSlug();
  const actor = useQuery(
    api.fdes.getBySlug,
    actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const run = useRunMutation(api.engagements.reassign);

  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  // Seed selection from current active assignments when they arrive.
  useEffect(() => {
    if (!assignments) return;
    const active = assignments
      .filter((a) => a.removed_at === null)
      .map((a) => a.fde_id);
    setSelected(active);
  }, [assignments]);

  const submit = async () => {
    if (!eng || !actor) {
      toast.error(!actor ? "Pick an actor FDE first." : "Engagement missing.");
      return;
    }
    setPending(true);
    await run(
      {
        id: eng._id as never,
        actor_fde_id: actor._id as never,
        fde_ids: selected as never[],
      },
      { success: "Reassigned" },
    );
    setPending(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Reassign engagement"
      description="Toggle FDEs in or out. Diff is written as removed_at + new assignments — history preserved."
      footer={
        <>
          <DialogButton onClick={onClose} disabled={pending}>
            Cancel
          </DialogButton>
          <DialogButton variant="primary" onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </DialogButton>
        </>
      }
    >
      <DialogField label="Team">
        <div className="flex flex-wrap gap-2">
          {(fdes ?? []).map((f) => {
            const checked = selected.includes(f._id);
            return (
              <button
                type="button"
                key={f._id}
                onClick={() =>
                  setSelected((prev) =>
                    prev.includes(f._id)
                      ? prev.filter((x) => x !== f._id)
                      : [...prev, f._id],
                  )
                }
                className={`h-7 px-2 rounded-sm text-[12px] border ${
                  checked
                    ? "bg-ink text-page border-ink"
                    : "border-line bg-page text-ink-2 hover:bg-surface"
                }`}
              >
                {f.name}
              </button>
            );
          })}
        </div>
        {selected.length === 0 && (
          <p className="mt-2 text-[12px] text-accent">
            Zero FDEs assigned. The engagement will surface as unassigned in
            the workload board.
          </p>
        )}
      </DialogField>
    </Dialog>
  );
}
