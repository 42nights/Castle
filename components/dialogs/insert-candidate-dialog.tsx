"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
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
import type { Id } from "@/convex/_generated/dataModel";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";

type Category = "GTM" | "Ops" | "Content" | "BD" | "Research";

type Candidate = {
  _id: Id<"template_github_candidates">;
  github_repo: string;
  name: string;
  description?: string;
};

function titleCase(s: string): string {
  return s
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function InsertCandidateDialog({
  candidate,
  onClose,
}: {
  candidate: Candidate;
  onClose: () => void;
}) {
  const router = useRouter();
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

  const createFromCandidate = useRunMutation(api.templates.createFromCandidate);

  const [name, setName] = useState(titleCase(candidate.name));
  const [category, setCategory] = useState<Category>("Ops");
  const [originId, setOriginId] = useState("");
  const [authorId, setAuthorId] = useState("");
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !originId || !authorId) {
      toast.error("Name, origin customer, and author required.");
      return;
    }
    setPending(true);
    const created = (await createFromCandidate(
      {
        candidate_id: candidate._id as never,
        name: name.trim(),
        category,
        origin_customer_id: originId as never,
        authored_by_fde_id: authorId as never,
        actor_fde_id: (actor?._id ?? null) as never,
      },
      { success: "Template created" },
    )) as { id: string; slug: string } | undefined;

    if (created?.slug) {
      onClose();
      router.push(`/templates/${created.slug}`);
    } else {
      setPending(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Insert as template"
      description={
        <>
          Preview for{" "}
          <a
            href={`https://github.com/${candidate.github_repo}`}
            target="_blank"
            rel="noreferrer"
            className="text-ink underline underline-offset-2 decoration-line"
          >
            {candidate.github_repo}
          </a>
          {candidate.description && (
            <span className="block mt-1 text-ink-3">
              {candidate.description}
            </span>
          )}
        </>
      }
      size="lg"
      footer={
        <>
          <DialogButton onClick={onClose} disabled={pending}>
            Cancel
          </DialogButton>
          <DialogButton
            variant="primary"
            type="submit"
            form="insert-candidate-form"
            disabled={pending}
          >
            {pending ? "Inserting…" : "Insert as Template"}
          </DialogButton>
        </>
      }
    >
      <form id="insert-candidate-form" onSubmit={onSubmit}>
        <DialogField label="Name">
          <DialogInput
            value={name}
            onChange={(e) => setName(e.target.value)}
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
        <p className="text-[12px] text-ink-3 leading-snug">
          Capabilities will be empty initially — use Castle chat on the
          template detail page to analyze the repo and auto-fill them.
        </p>
      </form>
    </Dialog>
  );
}
