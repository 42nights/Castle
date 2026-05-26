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
        title="Connections"
        description={`${toolkits.length || "—"} services in Composio's catalog. Filter by category, search by name, click connect on any with one-click OAuth.`}
      />

      {!configured && (
        <div className="rounded-lg bg-surface border border-line overflow-hidden mb-4">
          <header className="px-4 py-3 border-b border-line">
            <h2 className="t-h2">Setup required</h2>
          </header>
          <div className="px-4 py-3 text-[13px] text-ink-2 leading-snug space-y-2">
            <p>
              Composio drives external services. Add{" "}
              <span className="num text-ink">COMPOSIO_API_KEY</span> to{" "}
              <span className="num text-ink">.env.local</span> and restart{" "}
              <span className="num text-ink">pnpm dev</span>.
            </p>
            <p className="text-ink-3 text-[12px]">
              Get a key at{" "}
              <a
                href="https://app.composio.dev/api-keys"
                target="_blank"
                rel="noreferrer"
                className="text-ink hover:underline underline-offset-2 decoration-line"
              >
                app.composio.dev/api-keys
              </a>
              .
            </p>
          </div>
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
