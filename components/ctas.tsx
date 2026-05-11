"use client";

import { useState } from "react";
import { CreateCustomerDialog } from "@/components/dialogs/create-customer-dialog";
import { CreateDeploymentDialog } from "@/components/dialogs/create-deployment-dialog";
import { CreateFdeDialog } from "@/components/dialogs/create-fde-dialog";
import { CreateTemplateDialog } from "@/components/dialogs/create-template-dialog";
import { ReassignEngagementDialog } from "@/components/dialogs/reassign-engagement-dialog";

const baseBtn =
  "h-8 px-3 rounded-sm border border-line bg-page hover:bg-surface text-[12.5px] text-ink";
const compactBtn =
  "h-7 px-2 rounded-sm border border-line bg-page hover:bg-surface text-[12px] text-ink";

export function NewCustomerButton({ label = "+ New customer" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={baseBtn} onClick={() => setOpen(true)}>
        {label}
      </button>
      <CreateCustomerDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function NewFdeButton({ label = "+ New FDE" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={baseBtn} onClick={() => setOpen(true)}>
        {label}
      </button>
      <CreateFdeDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function NewTemplateButton({ label = "+ New template" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={baseBtn} onClick={() => setOpen(true)}>
        {label}
      </button>
      <CreateTemplateDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function NewDeploymentButton({
  engagementId,
  customerId,
  label = "+ Deployment",
}: {
  engagementId: string;
  customerId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={compactBtn} onClick={() => setOpen(true)}>
        {label}
      </button>
      <CreateDeploymentDialog
        open={open}
        onClose={() => setOpen(false)}
        engagementId={engagementId}
        customerId={customerId}
      />
    </>
  );
}

export function ReassignButton({
  engagementSlug,
  label = "Reassign",
}: {
  engagementSlug: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={compactBtn} onClick={() => setOpen(true)}>
        {label}
      </button>
      <ReassignEngagementDialog
        open={open}
        onClose={() => setOpen(false)}
        engagementSlug={engagementSlug}
      />
    </>
  );
}
