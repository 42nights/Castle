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
        title="Extractions"
        description="Custom work → shared template, in time order."
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
