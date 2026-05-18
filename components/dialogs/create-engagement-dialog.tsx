"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogButton,
  DialogField,
  DialogInput,
  DialogSelect,
  DialogTextarea,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";

type Phase = "discovery" | "build" | "deployed" | "support";
type Health = "green" | "yellow" | "red";

export function CreateEngagementDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const customers = useQuery(api.customers.list) as
    | Array<{ _id: string; slug: string; name: string }>
    | undefined;
  const fdes = useQuery(api.fdes.list) as
    | Array<{ _id: string; slug: string; name: string }>
    | undefined;
  const [actorSlug] = useActorSlug();
  const actor = useQuery(
    api.fdes.getBySlug,
    actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const run = useRunMutation(api.engagements.create);

  const [customerId, setCustomerId] = useState("");
  const [selectedFdes, setSelectedFdes] = useState<string[]>([]);
  const [start, setStart] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [end, setEnd] = useState(() =>
    new Date(Date.now() + 42 * 86400000).toISOString().slice(0, 10),
  );
  const [phase, setPhase] = useState<Phase>("discovery");
  const [weeklyHours, setWeeklyHours] = useState(20);
  const [progress, setProgress] = useState(0);
  const [health, setHealth] = useState<Health>("green");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      toast.error("Pick a customer.");
      return;
    }
    if (selectedFdes.length === 0) {
      toast.error("Assign at least one FDE.");
      return;
    }
    setPending(true);
    await run(
      {
        customer_id: customerId as never,
        fde_ids: selectedFdes as never,
        start_date: start,
        expected_end_date: end,
        phase,
        progress_pct: progress,
        weekly_hours: weeklyHours,
        health,
        notes,
        actor_fde_id: (actor?._id ?? null) as never,
      },
      { success: "Engagement created" },
    );
    setPending(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New engagement"
      description="One engagement per customer × phase × team. You can edit anything later."
      size="lg"
      footer={
        <>
          <DialogButton onClick={onClose} disabled={pending}>
            Cancel
          </DialogButton>
          <DialogButton
            variant="primary"
            type="submit"
            form="new-eng-form"
            disabled={pending}
          >
            {pending ? "Creating…" : "Create"}
          </DialogButton>
        </>
      }
    >
      <form id="new-eng-form" onSubmit={onSubmit}>
        <div className="grid md:grid-cols-2 gap-x-4">
          <DialogField label="Customer">
            <DialogSelect
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
            >
              <option value="">— pick —</option>
              {(customers ?? []).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </DialogSelect>
          </DialogField>
          <DialogField label="Phase">
            <DialogSelect
              value={phase}
              onChange={(e) => setPhase(e.target.value as Phase)}
            >
              <option value="discovery">discovery</option>
              <option value="build">build</option>
              <option value="deployed">deployed</option>
              <option value="support">support</option>
            </DialogSelect>
          </DialogField>
        </div>

        <DialogField label="FDEs assigned">
          <div className="flex flex-wrap gap-2">
            {(fdes ?? []).map((f) => {
              const checked = selectedFdes.includes(f._id);
              const tags = (f as { tags?: string[] }).tags ?? [];
              return (
                <button
                  type="button"
                  key={f._id}
                  onClick={() =>
                    setSelectedFdes((prev) =>
                      prev.includes(f._id)
                        ? prev.filter((x) => x !== f._id)
                        : [...prev, f._id],
                    )
                  }
                  title={tags.length > 0 ? tags.join(" · ") : undefined}
                  className={`min-h-7 px-2 py-1 rounded-sm text-[12px] border flex flex-col items-start leading-tight ${
                    checked
                      ? "bg-ink text-page border-ink"
                      : "border-line bg-page text-ink-2 hover:bg-surface"
                  }`}
                >
                  <span>{f.name}</span>
                  {tags.length > 0 && (
                    <span
                      className={`text-[10.5px] mt-0.5 ${
                        checked ? "text-page/60" : "text-ink-3"
                      }`}
                    >
                      {tags.slice(0, 4).join(" · ")}
                      {tags.length > 4 && ` · +${tags.length - 4}`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </DialogField>

        <div className="grid md:grid-cols-3 gap-x-4">
          <DialogField label="Start date">
            <DialogInput
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required
            />
          </DialogField>
          <DialogField label="Expected end">
            <DialogInput
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              required
            />
          </DialogField>
          <DialogField label="Weekly hours">
            <DialogInput
              type="number"
              min={0}
              step={1}
              value={weeklyHours}
              onChange={(e) => setWeeklyHours(Number(e.target.value) || 0)}
              required
            />
          </DialogField>
        </div>

        <div className="grid md:grid-cols-2 gap-x-4">
          <DialogField label="Progress %">
            <DialogInput
              type="number"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value) || 0)}
            />
          </DialogField>
          <DialogField label="Health">
            <DialogSelect
              value={health}
              onChange={(e) => setHealth(e.target.value as Health)}
            >
              <option value="green">green</option>
              <option value="yellow">yellow</option>
              <option value="red">red</option>
            </DialogSelect>
          </DialogField>
        </div>

        <DialogField label="This week's notes">
          <DialogTextarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Where this engagement is right now — what's working, what's stuck."
          />
        </DialogField>
      </form>
    </Dialog>
  );
}
