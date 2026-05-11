import { PageHeader, PageShell } from "@/components/page-shell";
import { loadAll } from "@/lib/data";
import { customerRows } from "@/lib/derive";
import { CustomersTable } from "./table";

export default function CustomersPage() {
  const { customers, deployments } = loadAll();
  const rows = customerRows(customers, deployments);
  return (
    <PageShell>
      <PageHeader
        eyebrow="— Customers"
        title="Who pays us, and how productized are they."
        description="Sorted by MRR. % template-based tells you which contracts are running on shared infrastructure vs. fully bespoke work."
      />
      <CustomersTable rows={rows} />
    </PageShell>
  );
}
