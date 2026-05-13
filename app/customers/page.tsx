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
        title="Customers"
        description="Sorted by MRR. % template indicates shared infrastructure vs. bespoke."
        actions={<NewCustomerButton />}
      />
      <CustomersTable rows={rows} />
    </PageShell>
  );
}
