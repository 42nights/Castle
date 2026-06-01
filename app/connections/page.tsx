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

      {/* Setup required banner — soft amber, not a plain panel */}
      {!configured && (
        <div
          role="alert"
          className="rounded-md bg-accent-soft px-4 py-3 mb-6 text-[13px] text-accent-ink border border-accent/20"
        >
          <p className="font-medium text-ink mb-0.5">Setup required</p>
          <p>
            Add{" "}
            <span className="font-mono text-[12px] bg-canvas px-1 py-px rounded-sm">
              COMPOSIO_API_KEY
            </span>{" "}
            to{" "}
            <span className="font-mono text-[12px] bg-canvas px-1 py-px rounded-sm">
              .env.local
            </span>{" "}
            and restart{" "}
            <span className="font-mono text-[12px] bg-canvas px-1 py-px rounded-sm">
              pnpm dev
            </span>
            . Get a key at{" "}
            <a
              href="https://app.composio.dev/api-keys"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-ink transition-colors"
            >
              app.composio.dev/api-keys
            </a>
            .
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
