import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton shown while the dashboard page is streaming.
 * Uses shadcn Skeleton primitives per MILESTONES.md.
 */
export default function AnalyzeLoading() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-6xl px-6 py-12 md:py-16">
        {/* Header skeleton */}
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-3 h-12 w-96" />
        <Skeleton className="mt-3 h-4 w-80" />

        {/* Contributors skeleton */}
        <div className="mt-10">
          <Skeleton className="h-8 w-40" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        </div>

        {/* Charts skeleton */}
        <div className="mt-10">
          <Skeleton className="h-8 w-40" />
          <div className="mt-6 grid grid-cols-12 gap-4">
            <Skeleton className="col-span-12 h-80 rounded-2xl" />
            <Skeleton className="col-span-12 lg:col-span-6 h-80 rounded-2xl" />
            <Skeleton className="col-span-12 lg:col-span-6 h-80 rounded-2xl" />
            <Skeleton className="col-span-12 h-80 rounded-2xl" />
            <Skeleton className="col-span-12 lg:col-span-8 h-64 rounded-2xl" />
            <Skeleton className="col-span-12 lg:col-span-6 h-64 rounded-2xl" />
            <Skeleton className="col-span-12 h-64 rounded-2xl" />
            <Skeleton className="col-span-12 h-64 rounded-2xl" />
          </div>
        </div>
      </div>
    </main>
  );
}
