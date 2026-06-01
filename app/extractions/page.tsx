import { PageHeader, PageShell } from "@/components/page-shell";
import { ExtractPatternButton } from "@/components/sections/extraction-cta";
import { loadOverview } from "@/lib/load-overview";
import { ExtractionsView } from "./view";

export const dynamic = "force-dynamic";

export default async function ExtractionsPage() {
  const { patternExtractions, customers, templates } = await loadOverview();
  return (
    <PageShell>
      <PageHeader
        variant="editorial"
        title="How custom work becomes a library."
        description="Every line below is a pattern we kept building until it was a shared template. Time order, newest first."
        actions={<ExtractPatternButton />}
      />
      <ExtractionsView
        extractions={patternExtractions}
        customers={customers}
        templates={templates}
      />
    </PageShell>
  );
}
