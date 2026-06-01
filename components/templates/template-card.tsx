"use client";

// TemplateCard — three visual variants by reuse count:
//   featured  (deploymentCount >= 5) : bigger reuse number in Fraunces amber, accent-soft bg tint
//   standard  (deploymentCount 2–4)  : normal card, reuse number in Fraunces 32px
//   quiet     (deploymentCount 0–1)  : inset/muted card, small reuse number

import { useState } from "react";
import Link from "next/link";
import { GitFork, Link2, Rocket } from "lucide-react";
import { toast } from "sonner";
import type { TemplateUsage } from "@/lib/derive";
import type { Customer, FDE } from "@/lib/types";
import { DeployDialog } from "./deploy-dialog";

function TagChip({ tag, onClick }: { tag: string; onClick?: (tag: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(tag)}
      className={[
        "inline-flex items-center h-6 px-2 rounded-sm text-xs transition-colors duration-instant",
        "bg-surface-1 text-ink-2 hover:bg-surface-2 hover:text-ink",
        "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
        onClick ? "cursor-pointer" : "cursor-default",
      ].join(" ")}
    >
      <span className="font-mono text-ink-3 mr-0.5">#</span>
      {tag}
    </button>
  );
}

function CopyLinkButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `https://castle.42nights.dev/templates/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied. Paste in Slack.");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Link copied" : "Copy link to this template"}
      title="Copy link"
      className="inline-flex items-center justify-center w-7 h-7 rounded-sm text-ink-3 hover:text-ink hover:bg-surface-1 transition-colors duration-instant focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
    >
      <Link2 size={14} aria-hidden />
    </button>
  );
}

type CardVariant = "featured" | "standard" | "quiet";

function getVariant(deploymentCount: number): CardVariant {
  if (deploymentCount >= 5) return "featured";
  if (deploymentCount >= 2) return "standard";
  return "quiet";
}

export function TemplateCard({
  usage,
  customers,
  fdes,
  onTagClick,
  style,
}: {
  usage: TemplateUsage;
  customers: Map<string, Customer>;
  fdes: Map<string, FDE>;
  onTagClick?: (tag: string) => void;
  style?: React.CSSProperties;
}) {
  const [deployOpen, setDeployOpen] = useState(false);
  const { template, deploymentCount } = usage;
  const variant = getVariant(deploymentCount);

  const origin = customers.get(template.origin_customer_id);
  const author = fdes.get(template.authored_by_fde_id);

  const cardBase = [
    "group relative flex flex-col rounded-md transition-[box-shadow,transform]",
    "duration-base ease-out-soft focus-within:shadow-[var(--shadow-md)]",
    "cursor-pointer",
    // Hover lift via CSS group hover
    "hover:-translate-y-px hover:shadow-[var(--shadow-md)]",
    "@media (prefers-reduced-motion: reduce) { transition: none; transform: none; }",
  ];

  const variantStyles: Record<CardVariant, string> = {
    featured: "bg-accent-soft shadow-[var(--shadow-base)] p-6",
    standard: "bg-canvas shadow-[var(--shadow-base)] p-6",
    quiet: "bg-surface-1 shadow-none p-5 border border-line",
  };

  const reuseNumberSize: Record<CardVariant, string> = {
    featured: "font-display text-[48px] leading-none tracking-[-0.02em] text-accent",
    standard: "font-display text-[32px] leading-none tracking-[-0.02em] text-ink",
    quiet: "font-display text-[22px] leading-none tracking-[-0.02em] text-ink-2",
  };

  const displayCount = deploymentCount > 0 ? deploymentCount : usage.customerCount - 1;

  return (
    <>
      <article
        className={[...cardBase, variantStyles[variant]].join(" ")}
        style={style}
      >
        {/* Main link covers the card body */}
        <Link
          href={`/templates/${template.id}`}
          className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
          aria-label={`Open ${template.name} template`}
          tabIndex={0}
        />

        {/* Eyebrow — category */}
        <div className="t-eyebrow mb-3 relative z-10">
          {template.category}
        </div>

        {/* Name — Inter 600, NOT Fraunces */}
        <h2 className="font-sans font-semibold text-[20px] leading-snug tracking-[-0.01em] text-ink mb-3 relative z-10">
          {template.name}
        </h2>

        {/* 3 capability bullets */}
        {template.capabilities.length > 0 && (
          <ul className="mb-4 space-y-1 relative z-10" aria-label="Capabilities">
            {template.capabilities.slice(0, 3).map((cap) => (
              <li key={cap} className="flex gap-2 text-sm text-ink-2">
                <span className="text-ink-3 shrink-0 mt-[1px]" aria-hidden>·</span>
                <span>{cap}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Tag chips — # mono treatment, click to filter */}
        {template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4 relative z-10">
            {template.tags.slice(0, 6).map((tag) => (
              <TagChip
                key={tag}
                tag={tag}
                onClick={onTagClick ? (t) => { onTagClick(t); } : undefined}
              />
            ))}
            {template.tags.length > 6 && (
              <span className="inline-flex items-center h-6 px-2 text-xs text-ink-3">
                +{template.tags.length - 6}
              </span>
            )}
          </div>
        )}

        {/* Spacer pushes reuse number + footer to bottom */}
        <div className="flex-1" />

        {/* Reuse number — the load-bearing visual */}
        <div className="mt-4 pt-4 border-t border-line relative z-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div
                className={reuseNumberSize[variant]}
                aria-label={`${deploymentCount} deployments`}
                title={`${deploymentCount} deployment${deploymentCount !== 1 ? "s" : ""} across ${usage.customerCount} customer${usage.customerCount !== 1 ? "s" : ""}`}
              >
                {displayCount > 0 ? displayCount : 0}
              </div>
              <div className="t-meta mt-1 text-ink-3">
                {deploymentCount === 1 ? "deployment" : "deployments"}
              </div>
            </div>

            {/* Origin caption */}
            <div className="text-right min-w-0">
              {(origin || author) && (
                <p className="text-[12px] text-ink-3 leading-snug">
                  {origin && (
                    <span>from {origin.name}</span>
                  )}
                  {origin && author && <span>, </span>}
                  {author && (
                    <span>by {author.name.split(" ")[0]}</span>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Hover action row — fades in on hover, always visible on touch */}
        <div
          className={[
            "mt-3 flex items-center gap-1 relative z-10",
            // Hide at rest on non-touch; fade in on hover
            "opacity-0 group-hover:opacity-100 transition-opacity duration-quick",
            // On touch screens (no hover), always show
            "@media (hover: none) { opacity: 1; }",
          ].join(" ")}
          // Prevent the card Link from capturing these clicks
          onClick={(e) => e.preventDefault()}
        >
          {/* Deploy */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDeployOpen(true);
            }}
            aria-label={`Deploy ${template.name}`}
            title="Deploy"
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-sm text-xs font-medium bg-ink text-paper shadow-[var(--shadow-sm)] hover:bg-ink-2 transition-colors duration-instant focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
          >
            <Rocket size={12} aria-hidden />
            Deploy
          </button>

          {/* Copy link */}
          <CopyLinkButton slug={template.id} />

          {/* GitHub */}
          {template.github_repo && (
            <a
              href={`https://github.com/${template.github_repo}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label={`View ${template.name} on GitHub`}
              title={template.github_repo}
              className="inline-flex items-center justify-center w-7 h-7 rounded-sm text-ink-3 hover:text-ink hover:bg-surface-1 transition-colors duration-instant focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
            >
              <GitFork size={14} aria-hidden />
            </a>
          )}
        </div>
      </article>

      {deployOpen && (
        <DeployDialog
          open={deployOpen}
          onClose={() => setDeployOpen(false)}
          templateId={template.id}
          templateName={template.name}
        />
      )}
    </>
  );
}
