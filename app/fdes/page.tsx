import { PageHeader, PageShell } from "@/components/page-shell";
import { NewFdeButton } from "@/components/ctas";
import { loadOverview } from "@/lib/load-overview";
import { fdeRows } from "@/lib/derive";
import { FdeCardGrid } from "@/components/fdes/fde-card-grid";

export const dynamic = "force-dynamic";

export default async function FdesPage() {
  const { fdes, engagements, customers } = await loadOverview();
  const rows = fdeRows(fdes, engagements, customers);
  return (
    <PageShell>
      <PageHeader
        variant="operator"
        title="Who&rsquo;s on the bench."
        description="Two founders right now. This page is built for when there are ten."
        actions={<NewFdeButton />}
      />
      <FdeCardGrid rows={rows} />
    </PageShell>
  );
}
