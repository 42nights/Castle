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

type Category = "GTM" | "Ops" | "Content" | "BD" | "Research";

export function CreateTemplateDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const customers = useQuery(api.customers.list) as
    | Array<{ _id: string; name: string }>
    | undefined;
  const fdes = useQuery(api.fdes.list) as
    | Array<{ _id: string; name: string }>
    | undefined;
  const [actorSlug] = useActorSlug();
  const actor = useQuery(
    api.fdes.getBySlug,
    actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const run = useRunMutation(api.templates.create);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("Ops");
  const [originId, setOriginId] = useState("");
  const [authorId, setAuthorId] = useState("");
  const [capsText, setCapsText] = useState("");
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !originId || !authorId) {
      toast.error("Name, origin customer, and author required.");
      return;
    }
    setPending(true);
    await run(
      {
        name: name.trim(),
        category,
        capabilities: capsText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
        origin_customer_id: originId as never,
        authored_by_fde_id: authorId as never,
        actor_fde_id: (actor?._id ?? null) as never,
      },
      { success: "Template added" },
    );
    setPending(false);
    setName("");
    setCapsText("");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New template"
      description="Capture a reusable pattern. Capabilities live as ordered rows you can edit later."
      size="lg"
      footer={
        <>
          <DialogButton onClick={onClose} disabled={pending}>
            Cancel
          </DialogButton>
          <DialogButton
            variant="primary"
            type="submit"
            form="new-template-form"
            disabled={pending}
          >
            {pending ? "Creating…" : "Create"}
          </DialogButton>
        </>
      }
    >
      <form id="new-template-form" onSubmit={onSubmit}>
        <DialogField label="Name">
          <DialogInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Deal-flow CPQ Agent"
            required
            autoFocus
          />
        </DialogField>
        <div className="grid md:grid-cols-3 gap-x-4">
          <DialogField label="Category">
            <DialogSelect
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              <option value="GTM">GTM</option>
              <option value="Ops">Ops</option>
              <option value="Content">Content</option>
              <option value="BD">BD</option>
              <option value="Research">Research</option>
            </DialogSelect>
          </DialogField>
          <DialogField label="Origin customer">
            <DialogSelect
              value={originId}
              onChange={(e) => setOriginId(e.target.value)}
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
          <DialogField label="Authored by">
            <DialogSelect
              value={authorId}
              onChange={(e) => setAuthorId(e.target.value)}
              required
            >
              <option value="">— pick —</option>
              {(fdes ?? []).map((f) => (
                <option key={f._id} value={f._id}>
                  {f.name}
                </option>
              ))}
            </DialogSelect>
          </DialogField>
        </div>
        <DialogField
          label="Capabilities"
          hint="One per line; order matters and is preserved as positions."
        >
          <DialogTextarea
            value={capsText}
            onChange={(e) => setCapsText(e.target.value)}
            placeholder={
              "Prospect enrichment\nCold email drafting\nFollow-up cadence"
            }
            rows={5}
          />
        </DialogField>
      </form>
    </Dialog>
  );
}
