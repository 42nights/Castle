import { PageHeader, PageShell } from "@/components/page-shell";
import { NewEngagementButton } from "@/components/sections/engagement-cta";
import { loadOverview } from "@/lib/load-overview";
import { engagementRows } from "@/lib/derive";
import { EngagementsList } from "@/components/engagements/engagements-list";

export const dynamic = "force-dynamic";

export default async function EngagementsPage() {
  const { engagements, customers, fdes } = await loadOverview();
  const rows = engagementRows(engagements, customers, fdes);
  return (
    <PageShell>
      <PageHeader
        variant="operator"
        title="What every FDE is working on, right now."
        description="Red and yellow surface at top by default. Click a row to read this week&rsquo;s notes."
        actions={<NewEngagementButton />}
      />
      <EngagementsList rows={rows} />
    </PageShell>
  );
}
