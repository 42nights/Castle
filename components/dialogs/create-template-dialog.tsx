"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
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
import { useFormDraft, relativeSince } from "@/lib/use-form-draft";
import { useRunMutation } from "@/lib/use-run-mutation";

type Category = "GTM" | "Ops" | "Content" | "BD" | "Research";

type Draft = {
  name: string;
  category: Category;
  originId: string;
  authorId: string;
  capsText: string;
  githubRepo: string;
  liveUrl: string;
};

const DRAFT_KEY = "castle.draft.create-template.v1";

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

  const draft = useFormDraft<Draft>(DRAFT_KEY);

  // Auto-restore on first hydrate. The Convex `_id` fields may reference
  // deleted rows, so we only restore them when the entity still exists in
  // the current options; otherwise blank them so the user re-picks.
  // Resets to false when the dialog closes so the next open can restore
  // afresh (e.g. crash mid-edit → reopen later).
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!open) restoredRef.current = false;
  }, [open]);
  useEffect(() => {
    if (!draft.hydrated || !draft.snapshot || restoredRef.current) return;
    if (!open) return; // wait until dialog actually opens
    const v = draft.snapshot.values;
    setName(v.name);
    setCategory(v.category);
    setCapsText(v.capsText);
    setGithubRepoValue(v.githubRepo);
    setLiveUrlValue(v.liveUrl);
    // Defer customer/author restore until the live lists arrive — those
    // useQuery calls return undefined briefly on mount.
    if (customers && customers.some((c) => c._id === v.originId)) {
      setOriginId(v.originId);
    } else {
      setOriginId("");
    }
    if (fdes && fdes.some((f) => f._id === v.authorId)) {
      setAuthorId(v.authorId);
    } else {
      setAuthorId("");
    }
    restoredRef.current = true;
  }, [draft.hydrated, draft.snapshot, open, customers, fdes]);

  // Persist on every field change. Skipped when the dialog isn't open
  // so closing-with-fields-cleared doesn't wipe the saved snapshot.
  useEffect(() => {
    if (!open) return;
    draft.save({
      name,
      category,
      originId,
      authorId,
      capsText,
      githubRepo,
      liveUrl,
    });
  }, [
    open,
    draft,
    name,
    category,
    originId,
    authorId,
    capsText,
    githubRepo,
    liveUrl,
  ]);

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
    draft.clear();
    onClose();
  };

  const discardDraft = () => {
    setName("");
    setCategory("Ops");
    setOriginId("");
    setAuthorId("");
    setCapsText("");
    setGithubRepoValue("");
    setLiveUrlValue("");
    draft.clear();
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
        {draft.snapshot && (
          <div className="mb-4 -mt-2 flex items-center justify-between gap-3 rounded-sm border border-line bg-surface px-2.5 py-1.5 text-[12px] text-ink-2">
            <span>
              Draft restored from{" "}
              <span className="num text-ink">
                {relativeSince(draft.snapshot.savedAt)}
              </span>
              . Autosaving.
            </span>
            <button
              type="button"
              onClick={discardDraft}
              className="text-ink-3 hover:text-accent underline underline-offset-2 decoration-line"
            >
              discard
            </button>
          </div>
        )}
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
