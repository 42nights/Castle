import { PageHeader, PageShell } from "@/components/page-shell";
import { loadAll } from "@/lib/data";
import { templateUsage } from "@/lib/derive";
import { TemplateGrid } from "./grid";

export default function TemplatesPage() {
  const { templates, deployments, customers, fdes } = loadAll();
  const usage = templateUsage(templates, deployments);
  return (
    <PageShell>
      <PageHeader
        eyebrow="— Templates"
        title="The library, growing one engagement at a time."
        description="Each template is a real customer workflow we kept building. Reuse count is the productization story."
      />
      <TemplateGrid usage={usage} customers={customers} fdes={fdes} />
    </PageShell>
  );
}
