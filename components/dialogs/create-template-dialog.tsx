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
  const setGithubRepo = useRunMutation(api.templates.setGithubRepo);
  const setLiveUrl = useRunMutation(api.templates.setLiveUrl);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("Ops");
  const [originId, setOriginId] = useState("");
  const [authorId, setAuthorId] = useState("");
  const [capsText, setCapsText] = useState("");
  const [githubRepo, setGithubRepoValue] = useState("");
  const [liveUrl, setLiveUrlValue] = useState("");
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !originId || !authorId) {
      toast.error("Name, origin customer, and author required.");
      return;
    }
    setPending(true);
    const created = (await run(
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
    )) as { id: string; slug: string } | undefined;
    // Apply optional URL fields in follow-up mutations — keeps the
    // primary `create` signature stable while letting the dialog
    // accept them in one form submission.
    if (created?.id) {
      const trimmedRepo = githubRepo.trim();
      if (trimmedRepo) {
        await setGithubRepo(
          {
            id: created.id as never,
            repo: trimmedRepo as never,
            actor_fde_id: (actor?._id ?? null) as never,
          },
          {},
        );
      }
      const trimmedLive = liveUrl.trim();
      if (trimmedLive) {
        await setLiveUrl(
          {
            id: created.id as never,
            url: trimmedLive as never,
            actor_fde_id: (actor?._id ?? null) as never,
          },
          {},
        );
      }
    }
    setPending(false);
    setName("");
    setCapsText("");
    setGithubRepoValue("");
    setLiveUrlValue("");
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
        <div className="grid md:grid-cols-2 gap-x-4">
          <DialogField
            label="GitHub repo"
            hint="Optional. owner/repo or full github.com URL. Powers the &lsquo;analyze repo&rsquo; tool."
          >
            <DialogInput
              value={githubRepo}
              onChange={(e) => setGithubRepoValue(e.target.value)}
              placeholder="42nights/deal-flow-scout"
            />
          </DialogField>
          <DialogField label="Live URL" hint="Optional. https://… for the deployed instance.">
            <DialogInput
              value={liveUrl}
              onChange={(e) => setLiveUrlValue(e.target.value)}
              placeholder="https://demo.42nights.dev"
            />
          </DialogField>
        </div>
        <DialogField
          label="Capabilities"
          hint="One per line; order matters and is preserved as positions. (You can also analyze a github repo on the detail page to auto-fill these.)"
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
