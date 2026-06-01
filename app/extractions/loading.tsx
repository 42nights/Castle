import { PageShellSkeleton, Skeleton } from "@/components/skeletons";

function TimelineNodeSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="flex gap-6 mb-6">
      {/* Date rail */}
      <div className="flex flex-col items-end gap-1">
        <Skeleton className="h-[11px] w-[68px]" />
        <div className="flex-1 w-px bg-line mt-1 min-h-[48px]" aria-hidden />
      </div>
      {/* Dot */}
      <div className="pt-1">
        <Skeleton className="h-3 w-3 rounded-full" />
      </div>
      {/* Card */}
      <div className="flex-1 pb-4">
        <div className="rounded-lg bg-canvas shadow-[var(--shadow-base)] p-4 flex flex-col gap-3">
          <Skeleton className="h-[14px]" style={{ width: wide ? "80%" : "60%" }} />
          <Skeleton className="h-[12px] w-[40%]" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-[12px] w-[50%]" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <PageShellSkeleton>
      {/* Editorial header skeleton — taller for Fraunces display title */}
      <header className="border-b border-line pb-12 mb-10 flex flex-col gap-3">
        <Skeleton className="h-[48px] w-[480px] max-w-full" />
        <Skeleton className="h-[16px] w-[360px] max-w-full" />
      </header>

      {/* Filter row skeleton */}
      <div className="flex items-center gap-3 mb-8">
        <Skeleton className="h-7 w-[140px]" />
        <Skeleton className="h-7 w-[140px]" />
        <Skeleton className="h-7 w-[200px]" />
      </div>

      {/* Timeline nodes */}
      <TimelineNodeSkeleton wide />
      <TimelineNodeSkeleton />
      <TimelineNodeSkeleton wide />
      <TimelineNodeSkeleton />
      <TimelineNodeSkeleton wide />
    </PageShellSkeleton>
  );
}
