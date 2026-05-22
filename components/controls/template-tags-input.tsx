"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useActorSlug } from "@/lib/use-actor";
import { useRunMutation } from "@/lib/use-run-mutation";

/**
 * Multi-tag editor for a template — free-form discovery tags
 * ("outreach", "github", "stargazer") sitting alongside the single
 * `category` enum. Autocomplete from the union of all template tags.
 *
 * Clone of FdeTagsInput; once we add a third copy, extract a generic
 * <TagsInput> primitive that takes known/setTags as props.
 */
export function TemplateTagsInput({
  templateSlug,
  current,
  mode = "row",
}: {
  templateSlug: string;
  current: string[];
  mode?: "row" | "block";
}) {
  const tpl = useQuery(api.templates.getBySlug, { slug: templateSlug }) as
    | { _id: string }
    | null
    | undefined;
  const [actorSlug] = useActorSlug();
  const actor = useQuery(
    api.fdes.getBySlug,
    actorSlug ? { slug: actorSlug } : "skip",
  ) as { _id: string } | null | undefined;
  const known =
    (useQuery(api.templates.listTags, {}) as string[] | undefined) ?? [];
  const run = useRunMutation(api.templates.setTags);

  const [open, setOpen] = useState(mode === "block");
  const [draft, setDraft] = useState("");
  const [hi, setHi] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = current.filter((t) => t && t !== "—");
  const selectedSet = new Set(selected.map((s) => s.toLowerCase()));
  const q = draft.trim().toLowerCase();
  const suggestions = known
    .filter((t) => !selectedSet.has(t.toLowerCase()))
    .filter((t) => !q || t.toLowerCase().includes(q))
    .slice(0, 8);
  const hasExactMatch = suggestions.some((s) => s.toLowerCase() === q);
  const canCreate = q.length > 0 && !hasExactMatch && !selectedSet.has(q);
  const options = canCreate
    ? [...suggestions, `__create__:${draft.trim()}`]
    : suggestions;

  useEffect(() => {
    if (mode !== "row" || !open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mode, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => setHi(0), [draft, open]);

  const commit = async (next: string[]) => {
    if (!tpl) {
      toast.error("Template not in Convex.");
      return;
    }
    await run(
      {
        id: tpl._id as never,
        tags: next as never,
        actor_fde_id: (actor?._id ?? null) as never,
      },
      { success: "Tags saved." },
    );
  };

  const addTag = (value: string) => {
    const v = value.trim();
    if (!v) return;
    if (selectedSet.has(v.toLowerCase())) return;
    commit([...selected, v]);
    setDraft("");
  };

  const removeTag = (value: string) => {
    commit(selected.filter((t) => t !== value));
  };

  const pickFromOption = (opt: string) => {
    if (opt.startsWith("__create__:"))
      addTag(opt.slice("__create__:".length));
    else addTag(opt);
  };

  if (mode === "row" && !open) {
    const display = selected.length === 0 ? "—" : selected.join(", ");
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="text-left text-[13px] text-ink-2 hover:text-ink hover:bg-surface rounded-sm px-1 -mx-1 truncate max-w-[220px]"
        title="Click to edit tags"
      >
        {display}
      </button>
    );
  }

  return (
    <div
      ref={ref}
      className="relative inline-block min-w-[220px] max-w-full"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-center gap-1 rounded-sm border border-line bg-page px-1.5 py-1 focus-within:border-ink-2">
        {selected.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-sm bg-surface px-1.5 py-[2px] text-[11.5px] text-ink"
          >
            {t}
            <button
              onClick={() => removeTag(t)}
              className="text-ink-3 hover:text-accent"
              title={`Remove ${t}`}
              aria-label={`Remove ${t}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => {
            if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
            setPanelOpen(true);
          }}
          onBlur={() => {
            blurTimerRef.current = setTimeout(
              () => setPanelOpen(false),
              150,
            );
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHi((i) => Math.min(i + 1, Math.max(0, options.length - 1)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHi((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (options[hi]) pickFromOption(options[hi]);
              else if (draft.trim()) addTag(draft);
            } else if (
              e.key === "Backspace" &&
              draft === "" &&
              selected.length
            ) {
              e.preventDefault();
              removeTag(selected[selected.length - 1]);
            } else if (e.key === "Escape" && mode === "row") {
              setOpen(false);
            }
          }}
          placeholder={selected.length === 0 ? "add tag…" : ""}
          className="flex-1 min-w-[80px] bg-transparent text-[12px] text-ink placeholder:text-ink-3 outline-none px-1"
        />
      </div>

      {panelOpen && options.length > 0 && (
        <ul className="absolute left-0 top-full z-30 mt-1 w-full max-w-[280px] rounded-sm border border-line bg-page py-1 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.45)]">
          {options.map((opt, i) => {
            const isCreate = opt.startsWith("__create__:");
            const label = isCreate
              ? opt.slice("__create__:".length)
              : opt;
            return (
              <li key={opt}>
                <button
                  onMouseEnter={() => setHi(i)}
                  onClick={() => pickFromOption(opt)}
                  className={`block w-full text-left px-2.5 py-1 text-[12px] ${
                    i === hi
                      ? "bg-surface text-ink"
                      : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {isCreate ? (
                    <>
                      <span className="text-ink-3">+ add</span> "{label}"
                    </>
                  ) : (
                    label
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Read-only chip rendering of template tags. Used on grid cards and
 *  anywhere we want to display tags without opening the editor. */
export function TemplateTagsChips({
  tags,
  max = 4,
  size = "sm",
}: {
  tags: string[];
  max?: number;
  size?: "xs" | "sm";
}) {
  if (!tags || tags.length === 0) return null;
  const visible = tags.slice(0, max);
  const overflow = tags.length - visible.length;
  const cls =
    size === "xs"
      ? "px-1 py-0 text-[10.5px]"
      : "px-1.5 py-[1px] text-[11px]";
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {visible.map((t) => (
        <span
          key={t}
          className={`inline-flex items-center rounded-sm bg-surface text-ink ${cls}`}
        >
          {t}
        </span>
      ))}
      {overflow > 0 && (
        <span className={`text-ink-3 num ${cls}`}>+{overflow}</span>
      )}
    </span>
  );
}
