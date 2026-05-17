import {
  CardGridSkeleton,
  PageHeaderSkeleton,
  PageShellSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <PageShellSkeleton>
      <PageHeaderSkeleton description actions={1} />
      <CardGridSkeleton cards={6} cols={3} />
    </PageShellSkeleton>
  );
}
