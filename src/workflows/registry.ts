/**
 * Built-in workflow registry. All built-ins are imported here so the
 * seedBuiltins Convex mutation has a single source to iterate over.
 */
import { morningBriefWorkflow } from "./builtins/morning-brief";
import type { WorkflowDefinitionT } from "./schema";

export const BUILTIN_WORKFLOWS: WorkflowDefinitionT[] = [
  morningBriefWorkflow,
];

export function getBuiltin(slug: string): WorkflowDefinitionT | undefined {
  return BUILTIN_WORKFLOWS.find((w) => w.slug === slug);
}
