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
import { useRunMutation } from "@/lib/use-run-mutation";

export function CreateDeploymentDialog({
  open,
  onClose,
  engagementId,
  customerId,
}: {
  open: boolean;
  onClose: () => void;
  engagementId: string;
  customerId: string;
}) {
  const templates = useQuery(api.templates.list) as
    | Array<{ _id: string; name: string }>
    | undefined;
  const run = useRunMutation(api.deployments.create);

  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [deployedAt, setDeployedAt] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [hoursReplaced, setHoursReplaced] = useState(4);
  const [customPct, setCustomPct] = useState(0);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Agent name required.");
      return;
    }
    setPending(true);
    await run(
      {
        customer_id: customerId as never,
        engagement_id: engagementId as never,
        template_id: (templateId || null) as never,
        agent_name: name.trim(),
        deployed_at: deployedAt,
        hours_replaced_per_week: hoursReplaced,
        customization_pct: customPct,
      },
      { success: "Deployment added" },
    );
    setPending(false);
    setName("");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New deployment"
      description="A concrete agent shipped to this customer, optionally based on a template."
      footer={
        <>
          <DialogButton onClick={onClose} disabled={pending}>
            Cancel
          </DialogButton>
          <DialogButton
            variant="primary"
            type="submit"
            form="new-deployment-form"
            disabled={pending}
          >
            {pending ? "Adding…" : "Add"}
          </DialogButton>
        </>
      }
    >
      <form id="new-deployment-form" onSubmit={onSubmit}>
        <DialogField label="Agent name">
          <DialogInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Cold Outreach Bot"
            required
            autoFocus
          />
        </DialogField>
        <DialogField label="Based on template (optional)">
          <DialogSelect
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">— fully custom —</option>
            {(templates ?? []).map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </DialogSelect>
        </DialogField>
        <div className="grid md:grid-cols-3 gap-x-4">
          <DialogField label="Deployed">
            <DialogInput
              type="date"
              value={deployedAt}
              onChange={(e) => setDeployedAt(e.target.value)}
              required
            />
          </DialogField>
          <DialogField label="Hrs replaced / wk">
            <DialogInput
              type="number"
              min={0}
              step={1}
              value={hoursReplaced}
              onChange={(e) =>
                setHoursReplaced(Number(e.target.value) || 0)
              }
            />
          </DialogField>
          <DialogField label="Customization %">
            <DialogInput
              type="number"
              min={0}
              max={100}
              value={customPct}
              onChange={(e) => setCustomPct(Number(e.target.value) || 0)}
            />
          </DialogField>
        </div>
      </form>
    </Dialog>
  );
}
