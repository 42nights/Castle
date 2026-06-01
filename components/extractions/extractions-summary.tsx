/**
 * ExtractionsSummary — editorial footer for /extractions.
 *
 * "Patterns extracted: N. Across M templates. Reused K times."
 * Rendered in Fraunces t-headline for emphasis.
 */

import type { PatternExtraction, Template, Customer } from "@/lib/types";

export function ExtractionsSummary({
  extractions,
}: {
  extractions: PatternExtraction[];
  // templates and customers accepted for forward-compatibility
  templates: Template[];
  customers: Customer[];
}) {
  const patternCount = extractions.length;
  const templateIds = new Set(extractions.map((e) => e.extracted_into_template_id));
  const templateCount = templateIds.size;
  const totalReuses = extractions.reduce(
    (s, e) => s + e.reused_at_customer_ids.length,
    0,
  );

  if (patternCount === 0) return null;

  return (
    <footer
      className="mt-12 pt-8 border-t border-line"
      aria-label="Extractions summary"
    >
      <p className="t-headline text-ink-2 leading-snug">
        Patterns extracted:{" "}
        <span className="text-ink font-mono tabular-nums">{patternCount}</span>.
        {" "}Across{" "}
        <span className="text-ink font-mono tabular-nums">{templateCount}</span>{" "}
        {templateCount === 1 ? "template" : "templates"}.{" "}
        Reused{" "}
        <span className="text-accent font-mono tabular-nums">{totalReuses}</span>{" "}
        {totalReuses === 1 ? "time" : "times"}.
      </p>
      <p className="mt-2 text-[13px] text-ink-3">
        Every reuse is an hour that didn&apos;t require building from scratch.
      </p>
    </footer>
  );
}
