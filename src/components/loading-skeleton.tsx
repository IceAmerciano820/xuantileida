export function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {/* Loading banner */}
      <div className="flex items-center gap-3 rounded-2xl border border-[rgba(0,212,255,0.15)] bg-[#1A1F2E]/60 p-4 backdrop-blur-xl">
        <svg
          className="h-5 w-5 shrink-0 animate-spin text-[#00D4FF]"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-white">正在全网采集热点...</p>
          <p className="text-xs text-[#8B92A8]">搜索微博、知乎、抖音、小红书等多平台数据，分析创作角度中</p>
        </div>
      </div>

      {/* Skeleton cards */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-[rgba(0,212,255,0.08)] bg-[#1A1F2E]/40 p-5 backdrop-blur-xl"
        >
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-md bg-[#252B3D]" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="h-4 w-3/4 rounded bg-[#252B3D]" />
              <div className="h-3 w-full rounded bg-[#1E2336]" />
              <div className="h-3 w-2/3 rounded bg-[#1E2336]" />
            </div>
            <div className="h-5 w-14 rounded-md bg-[#252B3D]" />
          </div>
          <div className="mt-4 space-y-2 rounded-xl bg-[#12162A]/60 p-3">
            <div className="h-3 w-1/4 rounded bg-[#252B3D]" />
            <div className="h-3 w-5/6 rounded bg-[#1E2336]" />
            <div className="h-3 w-4/6 rounded bg-[#1E2336]" />
          </div>
        </div>
      ))}
    </div>
  );
}
