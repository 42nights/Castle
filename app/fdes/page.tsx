import { PageHeader, PageShell } from "@/components/page-shell";
import { loadAll } from "@/lib/data";
import { fdeRows } from "@/lib/derive";
import { FdesTable } from "./table";

export default function FdesPage() {
  const { fdes, engagements, customers } = loadAll();
  const rows = fdeRows(fdes, engagements, customers);
  return (
    <PageShell>
      <PageHeader
        eyebrow="— FDEs"
        title="Who&rsquo;s on the bench."
        description="Two founders right now. This page is built for when there are ten."
      />
      <FdesTable rows={rows} />
    </PageShell>
  );
}
