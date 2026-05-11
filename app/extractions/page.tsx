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
        eyebrow="— Pattern extractions"
        title="From custom work to shared infrastructure."
        description="Every time a customer&rsquo;s problem becomes a template we can ship to the next one, it lands here. This log is the productization story."
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
