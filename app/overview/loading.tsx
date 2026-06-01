import {
  PageShellSkeleton,
  PanelSkeleton,
  Skeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <PageShellSkeleton>
      {/* EditorialGreeting skeleton */}
      <div className="mb-8">
        <Skeleton className="h-[24px] w-[180px]" />
      </div>

      {/* HeroMetrics skeleton — card shape */}
      <div className="mb-10 rounded-lg bg-canvas shadow-[var(--shadow-base)] p-6">
        <Skeleton className="h-[11px] w-[180px] mb-3" />
        <Skeleton className="h-[72px] w-[200px] mb-4" />
        <div className="grid grid-cols-4 gap-6 pt-4 border-t border-line">
          {[96, 80, 80, 64].map((w, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-[11px] w-12" />
              <Skeleton className="h-[18px]" style={{ width: w }} />
            </div>
          ))}
        </div>
      </div>

      {/* Attention skeleton */}
      <div className="mb-8">
        <Skeleton className="h-[11px] w-24 mb-4" />
        <div className="rounded-lg bg-canvas shadow-[var(--shadow-base)] overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`flex items-center gap-4 px-4 py-3 ${i > 1 ? "border-t border-line" : ""}`}>
              <Skeleton className="h-2 w-2 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-[13px] w-[60%]" />
                <Skeleton className="h-[11px] w-[40%] mt-1" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Phase columns skeleton */}
      <div className="mb-8">
        <Skeleton className="h-[11px] w-20 mb-4" />
        <div className="grid grid-cols-4 gap-3">
          {[3, 4, 2, 1].map((rows, i) => (
            <PanelSkeleton key={i} rows={rows} />
          ))}
        </div>
      </div>

      {/* 2-col board */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <PanelSkeleton rows={3} />
        <div className="flex flex-col gap-4">
          <PanelSkeleton rows={3} />
          <PanelSkeleton rows={2} />
        </div>
      </div>

      {/* Charts */}
      <PanelSkeleton rows={3} />
      <PanelSkeleton rows={4} />
    </PageShellSkeleton>
  );
}
