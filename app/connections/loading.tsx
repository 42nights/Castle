import {
  CardGridSkeleton,
  PageHeaderSkeleton,
  PageShellSkeleton,
  PanelSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <PageShellSkeleton>
      <PageHeaderSkeleton description />
      <PanelSkeleton rows={0}>
        <div className="px-3 py-2">
          <CardGridSkeleton cards={9} cols={3} />
        </div>
      </PanelSkeleton>
    </PageShellSkeleton>
  );
}
