import { PageHeader, PageShell } from "@/components/page-shell";
import { NewTemplateButton } from "@/components/ctas";
import { TemplateGithubCandidates } from "@/components/template-github-candidates";
import { loadTemplateData, requireSignedIn } from "@/lib/load-overview";
import { RoleProvider } from "@/lib/role-context";
import { templateUsage } from "@/lib/derive";
import { TemplateGrid } from "./grid";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const { isOperator } = await requireSignedIn();
  const { templates, deployments, customers, fdes, patternExtractions } =
    await loadTemplateData();
  const usage = templateUsage(templates, deployments, patternExtractions);
  return (
    <RoleProvider role={isOperator ? "operator" : "guest"}>
      <PageShell>
        <PageHeader
          title="The library, growing one engagement at a time."
          description="Each template is a real customer workflow we kept building. Reuse count is the productization story."
          actions={isOperator ? <NewTemplateButton /> : undefined}
        />
        {isOperator && <TemplateGithubCandidates />}
        <TemplateGrid usage={usage} customers={customers} fdes={fdes} />
      </PageShell>
    </RoleProvider>
  );
}
