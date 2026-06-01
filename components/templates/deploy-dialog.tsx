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

/**
 * DeployDialog — "Deploy {name} to which engagement?"
 *
 * Wires deployments.create with:
 *   customer_id, engagement_id, template_id (the current template),
 *   agent_name, deployed_at, hours_replaced_per_week, customization_pct
 *
 * Customer + engagement picker: lists all active engagements from Convex.
 * When a customer is chosen, filters engagements to that customer.
 */
export function DeployDialog({
  open,
  onClose,
  templateId,
  templateName,
}: {
  open: boolean;
  onClose: () => void;
  templateId: string;
  templateName: string;
}) {
  const engagements = useQuery(api.engagements.list) as
    | Array<{ _id: string; customer_id: string; phase: string; slug: string }>
    | undefined;

  const customers = useQuery(api.customers.list) as
    | Array<{ _id: string; name: string }>
    | undefined;

  const run = useRunMutation(api.deployments.create);

  const [customerId, setCustomerId] = useState("");
  const [engagementId, setEngagementId] = useState("");
  const [agentName, setAgentName] = useState("");
  const [deployedAt, setDeployedAt] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [hoursReplaced, setHoursReplaced] = useState(4);
  const [customPct, setCustomPct] = useState(0);
  const [pending, setPending] = useState(false);

  // When customer changes, reset engagement
  const handleCustomerChange = (id: string) => {
    setCustomerId(id);
    setEngagementId("");
  };

  const filteredEngagements =
    customerId && engagements
      ? engagements.filter((e) => e.customer_id === customerId)
      : (engagements ?? []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!engagementId) {
      toast.error("Select an engagement.");
      return;
    }
    if (!customerId) {
      toast.error("Select a customer.");
      return;
    }
    if (!agentName.trim()) {
      toast.error("Agent name is required.");
      return;
    }
    setPending(true);
    await run(
      {
        customer_id: customerId as never,
        engagement_id: engagementId as never,
        template_id: templateId as never,
        agent_name: agentName.trim(),
        deployed_at: deployedAt,
        hours_replaced_per_week: hoursReplaced,
        customization_pct: customPct,
      },
      { success: `${templateName} deployed.` },
    );
    setPending(false);
    setCustomerId("");
    setEngagementId("");
    setAgentName("");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Deploy ${templateName}`}
      description="Choose an engagement to deploy this template into."
      footer={
        <>
          <DialogButton onClick={onClose} disabled={pending}>
            Cancel
          </DialogButton>
          <DialogButton
            variant="primary"
            type="submit"
            form="deploy-template-form"
            disabled={pending}
          >
            {pending ? "Deploying…" : "Deploy"}
          </DialogButton>
        </>
      }
    >
      <form id="deploy-template-form" onSubmit={onSubmit}>
        <DialogField label="Customer">
          <DialogSelect
            value={customerId}
            onChange={(e) => handleCustomerChange(e.target.value)}
            required
            autoFocus
          >
            <option value="">— select a customer —</option>
            {(customers ?? []).map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </DialogSelect>
        </DialogField>

        <DialogField label="Engagement">
          <DialogSelect
            value={engagementId}
            onChange={(e) => setEngagementId(e.target.value)}
            required
            disabled={!customerId}
          >
            <option value="">— select an engagement —</option>
            {filteredEngagements.map((eng) => (
              <option key={eng._id} value={eng._id}>
                {eng.slug} · {eng.phase}
              </option>
            ))}
          </DialogSelect>
        </DialogField>

        <DialogField label="Agent name">
          <DialogInput
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder={`${templateName} Agent`}
            required
          />
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
              onChange={(e) => setHoursReplaced(Number(e.target.value) || 0)}
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
