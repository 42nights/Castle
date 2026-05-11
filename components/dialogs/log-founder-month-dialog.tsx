"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogButton,
  DialogField,
  DialogInput,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import { useRunMutation } from "@/lib/use-run-mutation";

export function LogFounderMonthDialog({
  open,
  onClose,
  initialMonth,
  initialHours = 0,
  initialArr = 0,
}: {
  open: boolean;
  onClose: () => void;
  initialMonth?: string;
  initialHours?: number;
  initialArr?: number;
}) {
  const run = useRunMutation(api.founderHours.upsertMonth);
  const [month, setMonth] = useState(
    () => initialMonth ?? new Date().toISOString().slice(0, 7),
  );
  const [hours, setHours] = useState(initialHours);
  const [arr, setArr] = useState(initialArr);
  const [pending, setPending] = useState(false);

  // Reset form state when the dialog opens with different initial props.
  // setState-during-render pattern keeps this lint-clean under React 19.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setMonth(initialMonth ?? new Date().toISOString().slice(0, 7));
      setHours(initialHours);
      setArr(initialArr);
      setPending(false);
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      toast.error("Use YYYY-MM format for month.");
      return;
    }
    setPending(true);
    await run(
      {
        month,
        founder_hours_total: hours,
        new_arr_dollars: arr,
      },
      { success: `Logged ${month}` },
    );
    setPending(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Log founder hours this month"
      description="Investor signal: founder hours per dollar of new ARR. Lower is more leverage."
      footer={
        <>
          <DialogButton onClick={onClose} disabled={pending}>
            Cancel
          </DialogButton>
          <DialogButton
            variant="primary"
            type="submit"
            form="log-month-form"
            disabled={pending}
          >
            {pending ? "Saving…" : "Save"}
          </DialogButton>
        </>
      }
    >
      <form id="log-month-form" onSubmit={onSubmit}>
        <DialogField label="Month (YYYY-MM)">
          <DialogInput
            type="text"
            inputMode="numeric"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            placeholder="2026-05"
            pattern="\d{4}-\d{2}"
            required
          />
        </DialogField>
        <DialogField label="Total founder hours">
          <DialogInput
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value) || 0)}
            required
          />
        </DialogField>
        <DialogField
          label="New ARR added ($)"
          hint="Annualized — sum of new contracts × 12 brought on this month"
        >
          <DialogInput
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            value={arr}
            onChange={(e) => setArr(Number(e.target.value) || 0)}
            required
          />
        </DialogField>
      </form>
    </Dialog>
  );
}
