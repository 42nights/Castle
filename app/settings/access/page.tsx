import { PageHeader, PageShell } from "@/components/page-shell";
import { requireOperator } from "@/lib/load-overview";
import { AllowlistManager } from "./manager";

export const dynamic = "force-dynamic";

export default async function AccessSettingsPage() {
  await requireOperator();
  return (
    <PageShell>
      <PageHeader
        variant="operator"
        title="Who can sign in to Castle."
        description={
          <>
            Only emails matching one of these patterns. Use{" "}
            <span className="font-mono text-[12px] bg-surface-1 px-1 py-px rounded-sm">
              *@example.com
            </span>{" "}
            for a whole domain or a full address for one person.
          </>
        }
      />
      <AllowlistManager />
    </PageShell>
  );
}
