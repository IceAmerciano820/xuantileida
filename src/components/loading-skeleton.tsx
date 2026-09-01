"use client";

import { useTheme } from "@/hooks/use-theme";

interface LoadingSkeletonProps {
  phase?: string;
  progress?: { completed: number; total: number };
}

export function LoadingSkeleton({ phase, progress }: LoadingSkeletonProps) {
  const { isDark } = useTheme();

  const progressPercent = progress ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Progress banner with radar pulse */}
      <div className={`flex items-center gap-3 overflow-hidden rounded-xl border px-4 py-3 ${
        isDark ? "border-[rgba(0,212,255,0.08)] bg-[#12162A]/50" : "border-gray-200 bg-white shadow-sm"
      }`}>
        {/* Radar pulse icon */}
        <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none" className="absolute inset-0">
            <circle cx="16" cy="16" r="14" stroke="#00D4FF" strokeWidth="1.5" strokeOpacity="0.25" />
            <circle cx="16" cy="16" r="9" stroke="#00D4FF" strokeWidth="1" strokeOpacity="0.15" />
            <circle cx="16" cy="16" r="1.5" fill="#00D4FF" />
          </svg>
          <span className="absolute inset-0 rounded-full" style={{ animation: "radar-pulse 1.5s ease-in-out infinite" }}>
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="14" stroke="#00D4FF" strokeWidth="1.5" fill="none" />
            </svg>
          </span>
        </div>
        <span className={`text-sm ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>
          {phase || "正在全网雷达扫描..."}
        </span>
        {progress ? (
          <div className="ml-auto flex items-center gap-2">
            <span className={`text-xs font-medium ${isDark ? "text-[#00D4FF]" : "text-[#00B4D8]"}`}>
              {progress.completed}/{progress.total}
            </span>
            <div className="relative h-1.5 w-20 overflow-hidden rounded-full bg-[#252B3D]/50">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#FF6B35] to-[#00D4FF] transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="relative ml-auto h-1 w-24 overflow-hidden rounded-full bg-[#252B3D]/50">
            <div className="absolute inset-y-0 left-0 w-1/4 rounded-full bg-gradient-to-r from-[#FF6B35] to-[#00D4FF]" style={{ animation: "progress 1.5s ease-in-out infinite" }} />
          </div>
        )}
      </div>

      {/* Skeleton cards - show 6 for better visual coverage */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={`rounded-2xl border p-5 ${
          isDark ? "border-[rgba(0,212,255,0.06)] bg-[#1A1F2E]/40" : "border-gray-100 bg-white shadow-sm"
        }`} style={{ animationDelay: `${i * 100}ms` }}>
          <div className="flex items-start gap-3">
            <div className={`h-6 w-6 shrink-0 rounded-md animate-pulse ${isDark ? "bg-[#252B3D]" : "bg-gray-200"}`} />
            <div className="flex-1 space-y-3">
              <div className={`h-5 w-3/4 rounded-lg animate-pulse ${isDark ? "bg-[#252B3D]" : "bg-gray-200"}`} />
              <div className="flex items-center gap-2">
                <div className={`h-5 w-16 rounded-md animate-pulse ${isDark ? "bg-[#252B3D]" : "bg-gray-200"}`} />
                <div className={`h-4 w-12 rounded animate-pulse ${isDark ? "bg-[#252B3D]" : "bg-gray-200"}`} />
                <div className={`h-4 w-16 rounded animate-pulse ${isDark ? "bg-[#252B3D]" : "bg-gray-200"}`} />
              </div>
              <div className={`h-4 w-full rounded animate-pulse ${isDark ? "bg-[#252B3D]/60" : "bg-gray-100"}`} />
              <div className={`h-4 w-2/3 rounded animate-pulse ${isDark ? "bg-[#252B3D]/60" : "bg-gray-100"}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
