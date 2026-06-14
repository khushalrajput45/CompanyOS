export function PageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header skeleton */}
      <div className="h-14 border-b bg-card px-6 flex items-center justify-between shrink-0">
        <div className="space-y-1.5">
          <div className="skeleton-shimmer h-4 w-32 rounded-md" />
          <div className="skeleton-shimmer h-3 w-20 rounded-md" />
        </div>
        <div className="skeleton-shimmer h-8 w-24 rounded-md" />
      </div>

      {/* Content skeleton */}
      <div className="flex-1 p-6 space-y-4">
        {/* Filter row */}
        <div className="flex gap-3">
          <div className="skeleton-shimmer h-9 w-56 rounded-md" />
          <div className="skeleton-shimmer h-9 w-36 rounded-md" />
        </div>

        {/* Table skeleton */}
        <div className="rounded-lg border bg-card overflow-hidden">
          {/* Table header */}
          <div className="h-10 bg-muted/40 px-4 flex items-center gap-6 border-b">
            {[80, 120, 100, 80, 70, 60].map((w, i) => (
              <div key={i} className="skeleton-shimmer h-3 rounded" style={{ width: w }} />
            ))}
          </div>
          {/* Table rows */}
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="h-11 px-4 flex items-center gap-6 border-b last:border-0"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              {[80, 120, 100, 80, 70, 60].map((w, j) => (
                <div key={j} className="skeleton-shimmer h-3 rounded" style={{ width: w - (i % 3) * 10 }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-3 animate-fade-in">
      <div className="skeleton-shimmer h-4 w-1/3 rounded-md" />
      <div className="skeleton-shimmer h-8 w-1/2 rounded-md" />
      <div className="skeleton-shimmer h-3 w-2/3 rounded-md" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="h-14 border-b bg-card px-6 flex items-center shrink-0">
        <div className="skeleton-shimmer h-5 w-40 rounded-md" />
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPI cards row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="skeleton-shimmer h-3 w-24 rounded" />
                <div className="skeleton-shimmer h-8 w-8 rounded-md" />
              </div>
              <div className="skeleton-shimmer h-7 w-28 rounded" />
              <div className="skeleton-shimmer h-3 w-20 rounded" />
            </div>
          ))}
        </div>
        {/* Chart placeholder */}
        <div className="rounded-lg border bg-card p-5">
          <div className="skeleton-shimmer h-4 w-40 rounded-md mb-4" />
          <div className="skeleton-shimmer h-48 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
