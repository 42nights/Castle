"use client";

import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
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

export function ExtractPatternDialog({
  open,
  onClose,
  sourceEngagementSlug,
}: {
  open: boolean;
  onClose: () => void;
  /** Human-friendly engagement slug (`eng-pe-g`), not a Convex Id.
   *  The dialog resolves it to the matching Convex _id once the
   *  engagements list arrives. */
  sourceEngagementSlug?: string;
}) {
  const engagements = useQuery(api.engagements.list) as
    | Array<{
        _id: string;
        slug: string;
        customer_id: string;
        notes_current: string;
      }>
    | undefined;
  const customers = useQuery(api.customers.list) as
    | Array<{ _id: string; slug: string; name: string }>
    | undefined;
  const templates = useQuery(api.templates.list) as
    | Array<{ _id: string; slug: string; name: string }>
    | undefined;
  const [actorSlug] = useActorSlug();
  const actor = useQuery(
    api.fdes.getBySlug,
    actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const run = useRunMutation(api.patternExtractions.extract);

  const [engagementId, setEngagementId] = useState<string>("");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [templateId, setTemplateId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("Ops");
  const [newCapsText, setNewCapsText] = useState("");
  const [summary, setSummary] = useState("");
  const [reused, setReused] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  // Tracks which engagementId we've already auto-populated summary for,
  // so reopening the dialog (which clears it) triggers a fresh seed.
  const [summarySeededFor, setSummarySeededFor] = useState<string | null>(null);

  // Resolve the slug prop to a Convex _id once engagements load.
  const presetId =
    sourceEngagementSlug && engagements
      ? (engagements.find((e) => e.slug === sourceEngagementSlug)?._id ?? "")
      : "";

  // Reset form state when the dialog opens. Without this, reopening the
  // same dialog with a different `sourceEngagementSlug` keeps stale fields.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setEngagementId(presetId);
      setMode("existing");
      setTemplateId("");
      setNewName("");
      setNewCategory("Ops");
      setNewCapsText("");
      setSummary("");
      setReused([]);
      setSummarySeededFor(null); // re-seed on next open
      setPending(false);
    }
  }

  // If the dialog opened before engagements arrived, adopt the resolved
  // preset id as soon as it's available.
  if (open && presetId && !engagementId) {
    setEngagementId(presetId);
  }

  // Auto-populate summary from engagement notes when source is chosen.
  // Re-runs when either the user picks an engagement OR the engagements
  // query finishes loading (covers the preselected-source-on-open case).
  if (
    engagementId &&
    !summary &&
    engagements &&
    summarySeededFor !== engagementId
  ) {
    setSummarySeededFor(engagementId);
    const eng = engagements.find((e) => e._id === engagementId);
    if (eng) setSummary(eng.notes_current);
  }

  const customerById = useMemo(
    () => new Map((customers ?? []).map((c) => [c._id, c])),
    [customers],
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!engagementId) {
      toast.error("Pick a source engagement.");
      return;
    }
    if (mode === "existing" && !templateId) {
      toast.error("Pick a destination template.");
      return;
    }
    if (mode === "new" && !newName.trim()) {
      toast.error("Name the new template.");
      return;
    }
    if (!actor) {
      toast.error("Pick an actor FDE first.");
      return;
    }
    setPending(true);
    await run(
      {
        source_engagement_id: engagementId as never,
        source_engagement_summary: summary,
        target_template_id: mode === "existing" ? (templateId as never) : null,
        new_template:
          mode === "new"
            ? {
                name: newName.trim(),
                category: newCategory,
                capabilities: newCapsText
                  .split("\n")
                  .map((l) => l.trim())
                  .filter(Boolean),
                authored_by_fde_id: actor._id as never,
              }
            : null,
        reused_customer_ids: reused as never[],
        actor_fde_id: actor._id as never,
      },
      { success: "Pattern extracted" },
    );
    setPending(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Extract a pattern"
      description="Turn one customer's custom work into a template the next customer reuses."
      size="lg"
      footer={
        <>
          <DialogButton onClick={onClose} disabled={pending}>
            Cancel
          </DialogButton>
          <DialogButton
            variant="primary"
            type="submit"
            form="extract-form"
            disabled={pending}
          >
            {pending ? "Extracting…" : "Extract"}
          </DialogButton>
        </>
      }
    >
      <form id="extract-form" onSubmit={onSubmit}>
        <DialogField label="Source engagement">
          <DialogSelect
            value={engagementId}
            onChange={(e) => setEngagementId(e.target.value)}
            required
          >
            <option value="">— pick —</option>
            {(engagements ?? []).map((e) => {
              const c = customerById.get(e.customer_id);
              return (
                <option key={e._id} value={e._id}>
                  {c?.name ?? "?"} · {e.slug}
                </option>
              );
            })}
          </DialogSelect>
        </DialogField>

        <DialogField label="Destination">
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={`h-7 px-2 rounded-sm text-[12px] border ${
                mode === "existing"
                  ? "bg-ink text-page border-ink"
                  : "border-line bg-page text-ink-2"
              }`}
            >
              Existing template
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`h-7 px-2 rounded-sm text-[12px] border ${
                mode === "new"
                  ? "bg-ink text-page border-ink"
                  : "border-line bg-page text-ink-2"
              }`}
            >
              New template
            </button>
          </div>
          {mode === "existing" ? (
            <DialogSelect
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              required
            >
              <option value="">— pick —</option>
              {(templates ?? []).map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </DialogSelect>
          ) : (
            <div className="space-y-3">
              <DialogInput
                placeholder="Template name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <DialogSelect
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as Category)}
              >
                <option value="GTM">GTM</option>
                <option value="Ops">Ops</option>
                <option value="Content">Content</option>
                <option value="BD">BD</option>
                <option value="Research">Research</option>
              </DialogSelect>
              <DialogTextarea
                placeholder={
                  "Capabilities, one per line:\nProspect enrichment\nCold email drafting\n…"
                }
                value={newCapsText}
                onChange={(e) => setNewCapsText(e.target.value)}
                rows={4}
              />
            </div>
          )}
        </DialogField>

        <DialogField
          label="What the source needed"
          hint="Pre-filled from the engagement's notes — edit to taste."
        >
          <DialogTextarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
          />
        </DialogField>

        <DialogField
          label="Already reused at"
          hint="Optional. Toggle customers where this template has shipped."
        >
          <div className="flex flex-wrap gap-2">
            {(customers ?? []).map((c) => {
              const checked = reused.includes(c._id);
              return (
                <button
                  type="button"
                  key={c._id}
                  onClick={() =>
                    setReused((prev) =>
                      prev.includes(c._id)
                        ? prev.filter((x) => x !== c._id)
                        : [...prev, c._id],
                    )
                  }
                  className={`h-7 px-2 rounded-sm text-[12px] border ${
                    checked
                      ? "bg-ink text-page border-ink"
                      : "border-line bg-page text-ink-2 hover:bg-surface"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </DialogField>
      </form>
    </Dialog>
  );
}
