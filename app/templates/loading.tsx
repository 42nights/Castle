import { PageShell } from "@/components/page-shell";
import { Skeleton } from "@/components/skeletons";

// 6-card skeleton grid matching the Paper card layout (featured/standard/quiet variants).
export default function Loading() {
  return (
    <PageShell>
      {/* Editorial header skeleton — matches variant="editorial" 48px Fraunces title */}
      <div className="pb-12 mb-10 border-b border-line flex flex-col gap-3" aria-hidden>
        <Skeleton className="block h-12 w-[480px] max-w-full" />
        <Skeleton className="block h-4 w-[360px] max-w-full" />
      </div>

      {/* Filter chips + search */}
      <div className="flex flex-wrap gap-2 mb-8" aria-hidden>
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-16 rounded-full" />
        ))}
        <Skeleton className="ml-auto h-8 w-48 rounded-sm" />
      </div>

      {/* 6-card grid */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        aria-busy="true"
        aria-label="Loading templates"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="panel p-6 flex flex-col gap-3">
            {/* Eyebrow */}
            <Skeleton className="block h-3 w-12" />
            {/* Name */}
            <Skeleton className="block h-5 w-48 max-w-full" />
            {/* Capabilities */}
            <div className="space-y-1.5">
              <Skeleton className="block h-3 w-full" />
              <Skeleton className="block h-3 w-4/5" />
              <Skeleton className="block h-3 w-3/5" />
            </div>
            {/* Tags */}
            <div className="flex gap-1.5 mt-1">
              <Skeleton className="h-6 w-14 rounded-sm" />
              <Skeleton className="h-6 w-12 rounded-sm" />
              <Skeleton className="h-6 w-16 rounded-sm" />
            </div>
            {/* Reuse number + footer */}
            <div className="mt-auto pt-4 border-t border-line flex items-end justify-between">
              <Skeleton className="block h-10 w-12" />
              <Skeleton className="block h-3 w-28" />
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
