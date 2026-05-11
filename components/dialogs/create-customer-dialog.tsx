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

type Status = "active" | "churned" | "paused";
type Health = "green" | "yellow" | "red";

export function CreateCustomerDialog({
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
  const run = useRunMutation(api.customers.create);

  const [name, setName] = useState("");
  const [backedBy, setBackedBy] = useState("");
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [mrr, setMrr] = useState(0);
  const [status, setStatus] = useState<Status>("active");
  const [health, setHealth] = useState<Health>("green");
  const [isPe, setIsPe] = useState(false);
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
        backed_by: backedBy
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        start_date: start,
        status,
        current_mrr: mrr,
        is_pe: isPe,
        health,
        actor_fde_id: (actor?._id ?? null) as never,
      },
      { success: "Customer added" },
    );
    setPending(false);
    setName("");
    setBackedBy("");
    setMrr(0);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New customer"
      footer={
        <>
          <DialogButton onClick={onClose} disabled={pending}>
            Cancel
          </DialogButton>
          <DialogButton
            variant="primary"
            type="submit"
            form="new-customer-form"
            disabled={pending}
          >
            {pending ? "Creating…" : "Create"}
          </DialogButton>
        </>
      }
    >
      <form id="new-customer-form" onSubmit={onSubmit}>
        <DialogField label="Name">
          <DialogInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </DialogField>
        <DialogField label="Backed by" hint="Comma-separated funds; — for none">
          <DialogInput
            value={backedBy}
            onChange={(e) => setBackedBy(e.target.value)}
            placeholder="Y Combinator, a16z"
          />
        </DialogField>
        <div className="grid md:grid-cols-2 gap-x-4">
          <DialogField label="Start date">
            <DialogInput
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required
            />
          </DialogField>
          <DialogField label="MRR ($)">
            <DialogInput
              type="number"
              min={0}
              step={50}
              value={mrr}
              onChange={(e) => setMrr(Number(e.target.value) || 0)}
            />
          </DialogField>
        </div>
        <div className="grid md:grid-cols-3 gap-x-4">
          <DialogField label="Status">
            <DialogSelect
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
            >
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="churned">churned</option>
            </DialogSelect>
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
          <DialogField label="PE firm">
            <DialogSelect
              value={isPe ? "yes" : "no"}
              onChange={(e) => setIsPe(e.target.value === "yes")}
            >
              <option value="no">no</option>
              <option value="yes">yes</option>
            </DialogSelect>
          </DialogField>
        </div>
      </form>
    </Dialog>
  );
}
