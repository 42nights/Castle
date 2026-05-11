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

type Severity = "critical" | "high" | "medium";

export function ManualAttentionDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const fdes = useQuery(api.fdes.list) as
    | Array<{ _id: string; slug: string; name: string }>
    | undefined;
  const customers = useQuery(api.customers.list) as
    | Array<{ _id: string; slug: string; name: string }>
    | undefined;
  const engagements = useQuery(api.engagements.list) as
    | Array<{ _id: string; slug: string }>
    | undefined;
  const [actorSlug] = useActorSlug();
  const actor = useQuery(
    api.fdes.getBySlug,
    actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const run = useRunMutation(api.attention.createManualItem);

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [ownerId, setOwnerId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [engagementId, setEngagementId] = useState("");
  const [href, setHref] = useState("/");
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title required.");
      return;
    }
    setPending(true);
    await run(
      {
        title: title.trim(),
        subtitle: subtitle.trim(),
        severity,
        owner_fde_id: (ownerId || null) as never,
        related_customer_id: (customerId || null) as never,
        related_engagement_id: (engagementId || null) as never,
        href: href || "/",
        actor_fde_id: (actor?._id ?? null) as never,
      },
      { success: "Reminder added" },
    );
    setPending(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add reminder"
      description="Shows up in the operator queue until resolved."
      footer={
        <>
          <DialogButton onClick={onClose} disabled={pending}>
            Cancel
          </DialogButton>
          <DialogButton
            variant="primary"
            type="submit"
            form="manual-attention-form"
            disabled={pending}
          >
            {pending ? "Adding…" : "Add"}
          </DialogButton>
        </>
      }
    >
      <form id="manual-attention-form" onSubmit={onSubmit}>
        <DialogField label="Title">
          <DialogInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Call PE-H champion next Tuesday"
            required
          />
        </DialogField>
        <DialogField label="Detail (optional)">
          <DialogTextarea
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            rows={2}
          />
        </DialogField>
        <div className="grid md:grid-cols-2 gap-x-4">
          <DialogField label="Severity">
            <DialogSelect
              value={severity}
              onChange={(e) => setSeverity(e.target.value as Severity)}
            >
              <option value="medium">medium · watch</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </DialogSelect>
          </DialogField>
          <DialogField label="Owner">
            <DialogSelect
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
            >
              <option value="">— unassigned —</option>
              {(fdes ?? []).map((f) => (
                <option key={f._id} value={f._id}>
                  {f.name}
                </option>
              ))}
            </DialogSelect>
          </DialogField>
        </div>
        <div className="grid md:grid-cols-2 gap-x-4">
          <DialogField label="Related customer (optional)">
            <DialogSelect
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">— none —</option>
              {(customers ?? []).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </DialogSelect>
          </DialogField>
          <DialogField label="Related engagement (optional)">
            <DialogSelect
              value={engagementId}
              onChange={(e) => setEngagementId(e.target.value)}
            >
              <option value="">— none —</option>
              {(engagements ?? []).map((e) => (
                <option key={e._id} value={e._id}>
                  {e.slug}
                </option>
              ))}
            </DialogSelect>
          </DialogField>
        </div>
        <DialogField label="Open URL when clicked" hint="Defaults to /">
          <DialogInput
            value={href}
            onChange={(e) => setHref(e.target.value)}
            placeholder="/"
          />
        </DialogField>
      </form>
    </Dialog>
  );
}
