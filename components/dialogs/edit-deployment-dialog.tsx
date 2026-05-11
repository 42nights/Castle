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

export function EditDeploymentDialog({
  open,
  onClose,
  deploymentId,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  deploymentId: string;
  initial: {
    agent_name: string;
    template_id: string | null;
    hours_replaced_per_week: number;
    customization_pct: number;
    deployed_at: string;
  };
}) {
  const templates = useQuery(api.templates.list) as
    | Array<{ _id: string; name: string }>
    | undefined;
  const update = useRunMutation(api.deployments.update);
  const remove = useRunMutation(api.deployments.remove);

  const [agentName, setAgentName] = useState(initial.agent_name);
  const [templateId, setTemplateId] = useState(initial.template_id ?? "");
  const [hours, setHours] = useState(initial.hours_replaced_per_week);
  const [custom, setCustom] = useState(initial.customization_pct);
  const [deployedAt, setDeployedAt] = useState(initial.deployed_at);
  const [pending, setPending] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentName.trim()) {
      toast.error("Agent name required.");
      return;
    }
    setPending(true);
    await update(
      {
        id: deploymentId as never,
        patch: {
          agent_name: agentName.trim(),
          template_id: (templateId || null) as never,
          hours_replaced_per_week: hours,
          customization_pct: custom,
          deployed_at: deployedAt,
        } as never,
      },
      { success: "Deployment saved" },
    );
    setPending(false);
    onClose();
  };

  const del = async () => {
    if (!confirm("Remove this deployment? Hours replaced will drop accordingly."))
      return;
    setPending(true);
    await remove({ id: deploymentId as never }, { success: "Deployment removed" });
    setPending(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial.agent_name}
      description="Edit the deployment shape, or remove it entirely."
      footer={
        <>
          <DialogButton
            onClick={del}
            disabled={pending}
            className="!text-accent !border-accent/30"
          >
            Remove
          </DialogButton>
          <div className="flex-1" />
          <DialogButton onClick={onClose} disabled={pending}>
            Cancel
          </DialogButton>
          <DialogButton
            variant="primary"
            type="submit"
            form="edit-deployment-form"
            disabled={pending}
          >
            {pending ? "Saving…" : "Save"}
          </DialogButton>
        </>
      }
    >
      <form id="edit-deployment-form" onSubmit={save}>
        <DialogField label="Agent name">
          <DialogInput
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            required
          />
        </DialogField>
        <DialogField label="Based on template">
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
              value={hours}
              onChange={(e) => setHours(Number(e.target.value) || 0)}
            />
          </DialogField>
          <DialogField label="Customization %">
            <DialogInput
              type="number"
              min={0}
              max={100}
              value={custom}
              onChange={(e) => setCustom(Number(e.target.value) || 0)}
            />
          </DialogField>
        </div>
      </form>
    </Dialog>
  );
}
