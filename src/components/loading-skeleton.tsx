export function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Loading banner */}
      <div className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/50 p-4">
        <svg
          className="h-5 w-5 animate-spin text-amber-500"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <div>
          <p className="text-sm font-medium text-amber-700">
            正在全网采集热点...
          </p>
          <p className="text-xs text-amber-600/70">
            搜索微博、知乎、抖音、小红书等多平台数据，分析创作角度中
          </p>
        </div>
      </div>

      {/* Skeleton cards */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-[#E7E5E4] bg-white p-5"
        >
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-md bg-stone-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-stone-100" />
              <div className="h-3 w-full rounded bg-stone-50" />
              <div className="h-3 w-2/3 rounded bg-stone-50" />
            </div>
            <div className="h-5 w-12 rounded-md bg-stone-100" />
          </div>
          <div className="mt-3 ml-9 space-y-2 rounded-lg bg-[#FAFAF9] p-3">
            <div className="h-3 w-1/4 rounded bg-stone-100" />
            <div className="h-3 w-5/6 rounded bg-stone-50" />
            <div className="h-3 w-4/6 rounded bg-stone-50" />
          </div>
        </div>
      ))}
    </div>
  );
}
