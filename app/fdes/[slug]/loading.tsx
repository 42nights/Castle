import {
  PageHeaderSkeleton,
  PageShellSkeleton,
  PanelSkeleton,
  StatsStripSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <PageShellSkeleton>
      <PageHeaderSkeleton kicker description actions={1} />
      <StatsStripSkeleton />
      <PanelSkeleton count rows={3} />
      <PanelSkeleton count rows={4} />
      <PanelSkeleton count rows={2} />
    </PageShellSkeleton>
  );
}
