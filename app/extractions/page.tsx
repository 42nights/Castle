import { PageHeader, PageShell } from "@/components/page-shell";
import { loadAll } from "@/lib/data";
import { ExtractionsView } from "./view";

export default function ExtractionsPage() {
  const { patternExtractions, customers, templates } = loadAll();
  return (
    <PageShell>
      <PageHeader
        eyebrow="— Pattern extractions"
        title="From custom work to shared infrastructure."
        description="Every time a customer&rsquo;s problem becomes a template we can ship to the next one, it lands here. This log is the productization story."
      />
      <ExtractionsView
        extractions={patternExtractions}
        customers={customers}
        templates={templates}
      />
    </PageShell>
  );
}
