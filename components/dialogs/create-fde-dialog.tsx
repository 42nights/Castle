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
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";

type Role = "Founder" | "Senior FDE" | "FDE" | "Junior FDE";

export function CreateFdeDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [actorSlug] = useActorSlug();
  const actor = useQuery(
    api.fdes.getBySlug,
    actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const run = useRunMutation(api.fdes.create);

  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("FDE");
  const [isFounder, setIsFounder] = useState(false);
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [capacity, setCapacity] = useState(40);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name required.");
      return;
    }
    setPending(true);
    await run(
      {
        name: name.trim(),
        role,
        is_founder: isFounder,
        start_date: start,
        capacity_hours_per_week: capacity,
        actor_fde_id: (actor?._id ?? null) as never,
      },
      { success: "FDE added" },
    );
    setPending(false);
    setName("");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New FDE"
      footer={
        <>
          <DialogButton onClick={onClose} disabled={pending}>
            Cancel
          </DialogButton>
          <DialogButton
            variant="primary"
            type="submit"
            form="new-fde-form"
            disabled={pending}
          >
            {pending ? "Creating…" : "Create"}
          </DialogButton>
        </>
      }
    >
      <form id="new-fde-form" onSubmit={onSubmit}>
        <DialogField label="Name">
          <DialogInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </DialogField>
        <div className="grid md:grid-cols-2 gap-x-4">
          <DialogField label="Role">
            <DialogSelect
              value={role}
              onChange={(e) => {
                const r = e.target.value as Role;
                setRole(r);
                if (r === "Founder") setIsFounder(true);
              }}
            >
              <option value="Founder">Founder</option>
              <option value="Senior FDE">Senior FDE</option>
              <option value="FDE">FDE</option>
              <option value="Junior FDE">Junior FDE</option>
            </DialogSelect>
          </DialogField>
          <DialogField label="Co-founder">
            <DialogSelect
              value={isFounder ? "yes" : "no"}
              onChange={(e) => setIsFounder(e.target.value === "yes")}
            >
              <option value="no">no</option>
              <option value="yes">yes</option>
            </DialogSelect>
          </DialogField>
        </div>
        <div className="grid md:grid-cols-2 gap-x-4">
          <DialogField label="Start date">
            <DialogInput
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required
            />
          </DialogField>
          <DialogField label="Capacity (h / wk)" hint="40 for hires, 45+ for founders">
            <DialogInput
              type="number"
              min={0}
              step={1}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value) || 0)}
              required
            />
          </DialogField>
        </div>
      </form>
    </Dialog>
  );
}
