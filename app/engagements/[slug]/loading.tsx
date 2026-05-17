import {
  PageHeaderSkeleton,
  PageShellSkeleton,
  PanelSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <PageShellSkeleton>
      <PageHeaderSkeleton kicker description actions={2} />
      <PanelSkeleton rows={3} />
      <PanelSkeleton rows={5} />
      <PanelSkeleton count rows={3} />
      <PanelSkeleton count rows={2} />
      <PanelSkeleton rows={3} />
    </PageShellSkeleton>
  );
}
