import { PageHeader, PageShell } from "@/components/page-shell";
import { NewTemplateButton } from "@/components/ctas";
import { TemplateGithubCandidates } from "@/components/template-github-candidates";
import { loadOverview } from "@/lib/load-overview";
import { templateUsage } from "@/lib/derive";
import { TemplateGrid } from "./grid";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const { templates, deployments, customers, fdes, patternExtractions } =
    await loadOverview();
  const usage = templateUsage(templates, deployments, patternExtractions);
  return (
    <PageShell>
      <PageHeader
        title="The library, growing one engagement at a time."
        description="Each template is a real customer workflow we kept building. Reuse count is the productization story."
        actions={<NewTemplateButton />}
      />
      <TemplateGithubCandidates />
      <TemplateGrid usage={usage} customers={customers} fdes={fdes} />
    </PageShell>
  );
}
