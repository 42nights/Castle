"use client";

import { useState } from "react";
import { EditDeploymentDialog } from "@/components/dialogs/edit-deployment-dialog";

export function EditDeploymentButton({
  deploymentId,
  initial,
}: {
  deploymentId: string;
  initial: {
    agent_name: string;
    template_id: string | null;
    hours_replaced_per_week: number;
    customization_pct: number;
    deployed_at: string;
  };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="t-caption text-ink-2 hover:text-ink"
      >
        edit
      </button>
      <EditDeploymentDialog
        open={open}
        onClose={() => setOpen(false)}
        deploymentId={deploymentId}
        initial={initial}
      />
    </>
  );
}
