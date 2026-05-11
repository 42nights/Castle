import { PageHeader, PageShell } from "@/components/page-shell";
import { NewFdeButton } from "@/components/ctas";
import { loadOverview } from "@/lib/load-overview";
import { fdeRows } from "@/lib/derive";
import { FdesTable } from "./table";

export const dynamic = "force-dynamic";

export default async function FdesPage() {
  const { fdes, engagements, customers } = await loadOverview();
  const rows = fdeRows(fdes, engagements, customers);
  return (
    <PageShell>
      <PageHeader
        eyebrow="— FDEs"
        title="Who&rsquo;s on the bench."
        description="Two founders right now. This page is built for when there are ten."
        actions={<NewFdeButton />}
      />
      <FdesTable rows={rows} />
    </PageShell>
  );
}
