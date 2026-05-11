import { PageHeader, PageShell } from "@/components/page-shell";
import { loadAll } from "@/lib/data";
import { engagementRows } from "@/lib/derive";
import { EngagementsTable } from "./table";

export default function EngagementsPage() {
  const { engagements, customers, fdes } = loadAll();
  const rows = engagementRows(engagements, customers, fdes);
  return (
    <PageShell>
      <PageHeader
        eyebrow="— Engagements"
        title="What every FDE is working on, right now."
        description="The operational table. Red and yellow surface at top by default; click a row to open the engagement and read this week's notes."
      />
      <EngagementsTable rows={rows} />
    </PageShell>
  );
}
