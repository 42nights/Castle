"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogButton,
  DialogField,
  DialogInput,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";

export function DeleteEngagementZone({
  engagementSlug,
  customerName,
}: {
  engagementSlug: string;
  customerName: string;
}) {
  const router = useRouter();
  const eng = useQuery(api.engagements.getBySlug, { slug: engagementSlug }) as
    | { _id: string }
    | null
    | undefined;
  const [actorSlug] = useActorSlug();
  const actor = useQuery(
    api.fdes.getBySlug,
    actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const run = useRunMutation(api.engagements.remove);

  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);

  const ok = confirm.trim().toLowerCase() === customerName.toLowerCase();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok || !eng || !actor) {
      toast.error(!actor ? "Pick an actor FDE." : "Confirm name doesn't match.");
      return;
    }
    setPending(true);
    await run(
      { id: eng._id as never, actor_fde_id: actor._id as never },
      { success: "Engagement removed" },
    );
    setPending(false);
    setOpen(false);
    router.push("/engagements");
  };

  return (
    <section className="mt-20 pt-8 border-t border-line">
      <div className="flex items-end justify-between gap-6">
        <div>
          <div className="t-eyebrow mb-2">— Danger zone</div>
          <p className="text-ink-2 text-[13.5px] leading-relaxed max-w-md">
            Removing an engagement also cascades the assignments and deployments
            tied to it. Audit-log entries stay (one final &ldquo;delete&rdquo;
            row is written).
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="h-8 px-3 rounded-sm border border-accent/40 text-accent hover:bg-accent hover:text-page text-[12.5px]"
        >
          Delete engagement
        </button>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete engagement"
        description={
          <>
            This removes the engagement plus its assignments and deployments.
            Type the customer name (<span className="t-mono">{customerName}</span>
            ) to confirm.
          </>
        }
        footer={
          <>
            <DialogButton onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </DialogButton>
            <DialogButton
              type="submit"
              form="delete-eng-form"
              disabled={pending || !ok}
              className={ok ? "!bg-accent !text-page !border-accent" : ""}
            >
              {pending ? "Deleting…" : "Delete"}
            </DialogButton>
          </>
        }
      >
        <form id="delete-eng-form" onSubmit={submit}>
          <DialogField label={`Type "${customerName}" to confirm`}>
            <DialogInput
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoFocus
            />
          </DialogField>
        </form>
      </Dialog>
    </section>
  );
}

export function DeleteFdeZone({
  fdeSlug,
  fdeName,
  activeEngagementCount,
}: {
  fdeSlug: string;
  fdeName: string;
  activeEngagementCount: number;
}) {
  const router = useRouter();
  const fde = useQuery(api.fdes.getBySlug, { slug: fdeSlug }) as
    | { _id: string }
    | null
    | undefined;
  const run = useRunMutation(api.fdes.remove);

  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);

  const blocked = activeEngagementCount > 0;
  const ok = confirm.trim().toLowerCase() === fdeName.toLowerCase();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blocked) {
      toast.error(
        `Reassign or close ${activeEngagementCount} active engagement${
          activeEngagementCount === 1 ? "" : "s"
        } first.`,
      );
      return;
    }
    if (!ok || !fde) {
      toast.error("Confirm name doesn't match.");
      return;
    }
    setPending(true);
    await run(
      { id: fde._id as never },
      { success: `${fdeName} removed` },
    );
    setPending(false);
    setOpen(false);
    router.push("/fdes");
  };

  return (
    <section className="mt-20 pt-8 border-t border-line">
      <div className="flex items-end justify-between gap-6">
        <div>
          <div className="t-eyebrow mb-2">— Danger zone</div>
          <p className="text-ink-2 text-[13.5px] leading-relaxed max-w-md">
            Removing an FDE deletes their bench row entirely. Engagement
            assignments, deployments, and audit-log entries that reference
            this FDE stay — their `actor_fde_id` foreign key just dangles
            to a missing row. Reassign active engagements first.
            {blocked && (
              <>
                {" "}
                <span className="text-accent">
                  Currently blocked: {activeEngagementCount} active engagement
                  {activeEngagementCount === 1 ? "" : "s"}.
                </span>
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          disabled={blocked}
          className="h-8 px-3 rounded-sm border border-accent/40 text-accent hover:bg-accent hover:text-page text-[12.5px] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-accent"
          title={
            blocked
              ? "Reassign active engagements before deleting"
              : "Delete this FDE"
          }
        >
          Delete FDE
        </button>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Delete ${fdeName}`}
        description={
          <>
            This drops the FDE row. References from engagement assignments,
            deployments, and audit logs stay (dangling foreign keys).
            Type the name (<span className="t-mono">{fdeName}</span>) to
            confirm.
          </>
        }
        footer={
          <>
            <DialogButton onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </DialogButton>
            <DialogButton
              type="submit"
              form="delete-fde-form"
              disabled={pending || !ok}
              className={ok ? "!bg-accent !text-page !border-accent" : ""}
            >
              {pending ? "Deleting…" : "Delete"}
            </DialogButton>
          </>
        }
      >
        <form id="delete-fde-form" onSubmit={submit}>
          <DialogField label={`Type "${fdeName}" to confirm`}>
            <DialogInput
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoFocus
            />
          </DialogField>
        </form>
      </Dialog>
    </section>
  );
}
