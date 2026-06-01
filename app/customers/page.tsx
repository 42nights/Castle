import { PageHeader, PageShell } from "@/components/page-shell";
import { NewCustomerButton } from "@/components/ctas";
import { loadOverview } from "@/lib/load-overview";
import { customerRows } from "@/lib/derive";
import { CustomersTableNew } from "@/components/customers/customers-table";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const { customers, deployments } = await loadOverview();
  const rows = customerRows(customers, deployments);
  return (
    <PageShell>
      <PageHeader
        variant="operator"
        title="Who we ship for."
        description="Sorted by MRR. % template indicates shared infrastructure vs. bespoke."
        actions={<NewCustomerButton />}
      />
      <CustomersTableNew rows={rows} />
    </PageShell>
  );
}
