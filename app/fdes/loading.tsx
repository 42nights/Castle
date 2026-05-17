import {
  PageHeaderSkeleton,
  PageShellSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <PageShellSkeleton>
      <PageHeaderSkeleton description actions={1} />
      <TableSkeleton cols={6} rows={8} />
    </PageShellSkeleton>
  );
}
