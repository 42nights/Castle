"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CategoryBadge } from "@/components/atoms";
import { TemplateTagsChips } from "@/components/controls/template-tags-input";
import type { TemplateUsage } from "@/lib/derive";
import type { Customer, FDE, TemplateCategory } from "@/lib/types";
import { formatDate } from "@/lib/format";

type SortKey = "reused" | "newest" | "oldest" | "alpha";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "reused", label: "Most reused" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "alpha", label: "A → Z" },
];

const CATEGORIES: TemplateCategory[] = ["GTM", "Ops", "Content", "BD", "Research"];

export function TemplateGrid({
  usage,
  customers,
  fdes,
}: {
  usage: TemplateUsage[];
  customers: Customer[];
  fdes: FDE[];
}) {
  const [sort, setSort] = useState<SortKey>("reused");
  const [cat, setCat] = useState<TemplateCategory | "all">("all");
  const cById = new Map(customers.map((c) => [c.id, c]));
  const fById = new Map(fdes.map((f) => [f.id, f]));

  const filtered = useMemo(() => {
    const list = usage.filter(
      (u) => cat === "all" || u.template.category === cat
    );
    list.sort((a, b) => {
      if (sort === "alpha") return a.template.name.localeCompare(b.template.name);
      if (sort === "newest")
        return b.template.created_at.localeCompare(a.template.created_at);
      if (sort === "oldest")
        return a.template.created_at.localeCompare(b.template.created_at);
      if (b.deploymentCount !== a.deploymentCount)
        return b.deploymentCount - a.deploymentCount;
      return b.template.created_at.localeCompare(a.template.created_at);
    });
    return list;
  }, [usage, sort, cat]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          onClick={() => setCat("all")}
          className={chipClass(cat === "all")}
        >
          All categories
        </button>
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={chipClass(cat === c)}>
            {c}
          </button>
        ))}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="ml-auto h-8 rounded-sm border border-line bg-page px-2 text-[13px] text-ink-2 focus:outline-none focus:ring-1 focus:ring-ink"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              Sort · {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-line border border-line rounded-sm overflow-hidden">
        {filtered.map((u) => {
          const origin = cById.get(u.template.origin_customer_id);
          const author = fById.get(u.template.authored_by_fde_id);
          return (
            <Link
              key={u.template.id}
              href={`/templates/${u.template.id}`}
              className="group bg-page p-5 hover:bg-surface transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="t-h3">{u.template.name}</div>
                <CategoryBadge category={u.template.category} />
              </div>
              <ul className="mt-3 space-y-1 text-[13px] text-ink-2">
                {u.template.capabilities.slice(0, 3).map((cap) => (
                  <li key={cap} className="flex gap-2">
                    <span className="text-ink-3">·</span>
                    <span>{cap}</span>
                  </li>
                ))}
              </ul>
              {u.template.tags.length > 0 && (
                <div className="mt-3">
                  <TemplateTagsChips tags={u.template.tags} max={5} size="xs" />
                </div>
              )}
              <div className="mt-4 pt-3 border-t border-line t-caption flex items-center justify-between">
                <span className="num text-ink">
                  {u.customerCount} customer{u.customerCount === 1 ? "" : "s"} ·{" "}
                  {u.deploymentCount} dep
                </span>
                <span className="text-ink-3">
                  {origin?.name ?? "—"}, {author?.name.split(" ")[0] ?? "—"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between t-caption text-ink-3 gap-3">
                <span className="shrink-0">
                  Authored{" "}
                  <span className="num">
                    {formatDate(u.template.created_at)}
                  </span>
                </span>
                <span className="flex items-center gap-2 min-w-0 justify-end">
                  {u.template.live_url && (
                    <a
                      href={u.template.live_url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="num text-ink-2 hover:text-ink underline underline-offset-2 decoration-line truncate max-w-[140px]"
                      title={u.template.live_url}
                    >
                      ↗ {u.template.live_url.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                  {u.template.github_repo && (
                    <a
                      href={`https://github.com/${u.template.github_repo}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="num text-ink-2 hover:text-ink underline underline-offset-2 decoration-line truncate max-w-[160px]"
                      title={u.template.github_repo}
                    >
                      {u.template.github_repo}
                    </a>
                  )}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

function chipClass(active: boolean) {
  return [
    "h-7 px-2.5 rounded-sm text-[12px] tracking-[-0.005em] transition-colors",
    active
      ? "bg-ink text-page"
      : "border border-line bg-page text-ink-2 hover:text-ink hover:bg-surface",
  ].join(" ");
}
