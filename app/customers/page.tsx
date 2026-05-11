import { PageHeader, PageShell } from "@/components/page-shell";
import { NewCustomerButton } from "@/components/ctas";
import { loadOverview } from "@/lib/load-overview";
import { customerRows } from "@/lib/derive";
import { CustomersTable } from "./table";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const { customers, deployments } = await loadOverview();
  const rows = customerRows(customers, deployments);
  return (
    <PageShell>
      <PageHeader
        eyebrow="— Customers"
        title="Who pays us, and how productized are they."
        description="Sorted by MRR. % template-based tells you which contracts are running on shared infrastructure vs. fully bespoke work."
        actions={<NewCustomerButton />}
      />
      <CustomersTable rows={rows} />
    </PageShell>
  );
}
