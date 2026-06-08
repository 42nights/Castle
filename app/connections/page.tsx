import { PageHeader, PageShell } from "@/components/page-shell";
import { composio } from "@/lib/composio";
import { listToolkits } from "./actions";
import { ConnectionsView } from "./view";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ return?: string }>;
}) {
  const sp = await searchParams;
  const configured = composio() !== null;
  const toolkits = configured ? await listToolkits() : [];

  return (
    <PageShell>
      <PageHeader
        variant="operator"
        title="Tools Castle and Hermes can use."
        description="Composio bridges our agent to the outside world. Click connect on any service to wire it in with one-click OAuth."
        meta={
          toolkits.length > 0
            ? `${toolkits.length} services in catalog`
            : undefined
        }
      />

      {/* Integrations not yet connected — neutral, investor-facing empty state */}
      {!configured && (
        <div
          role="status"
          className="rounded-md bg-accent-soft px-4 py-3 mb-6 text-[13px] text-accent-ink border border-accent/20"
        >
          <p className="font-medium text-ink mb-0.5">Integrations coming online</p>
          <p>
            The integration catalog is being provisioned for this workspace.
            Once connected, you&apos;ll be able to wire any service to Castle and
            Hermes with one-click OAuth.
          </p>
        </div>
      )}

      <ConnectionsView
        configured={configured}
        toolkits={toolkits}
        justReturned={sp.return === "1"}
      />
    </PageShell>
  );
}
