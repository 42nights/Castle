import { PageHeader, PageShell } from "@/components/page-shell";
import { requireOperator } from "@/lib/load-overview";
import { AllowlistManager } from "./manager";

export const dynamic = "force-dynamic";

export default async function AccessSettingsPage() {
  await requireOperator();
  return (
    <PageShell>
      <PageHeader
        title="Access — email allowlist"
        description={
          <>
            Only emails matching one of these patterns can sign in to Castle.
            Use <span className="num text-ink">*@example.com</span> for a whole
            domain or a full address for one person. Hardcoded rescue entries
            (so we can&apos;t lock ourselves out) are listed read-only.
          </>
        }
      />
      <AllowlistManager />
    </PageShell>
  );
}
