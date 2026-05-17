import {
  PageHeaderSkeleton,
  PageShellSkeleton,
  PanelSkeleton,
  StatsStripSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <PageShellSkeleton>
      <PageHeaderSkeleton description />
      <PanelSkeleton rows={4} />
      <StatsStripSkeleton />
      <PanelSkeleton rows={4} />
      <PanelSkeleton rows={4} />
      <PanelSkeleton rows={3} />
      <PanelSkeleton rows={4} />
      <PanelSkeleton rows={3} />
    </PageShellSkeleton>
  );
}
