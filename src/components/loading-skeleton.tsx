"use client";

import { useTheme } from "@/hooks/use-theme";

export function LoadingSkeleton() {
  const { isDark } = useTheme();

  return (
    <div className="space-y-4">
      {/* Progress banner */}
      <div className={`flex items-center gap-3 overflow-hidden rounded-xl border px-4 py-3 ${
        isDark ? "border-[rgba(0,212,255,0.08)] bg-[#12162A]/50" : "border-gray-200 bg-white shadow-sm"
      }`}>
        <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#00D4FF]/20 border-t-[#00D4FF]" />
        <span className={`text-sm ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>正在全网搜索热点...</span>
        <div className="relative ml-auto h-1 w-24 overflow-hidden rounded-full bg-[#252B3D]/50">
          <div className="absolute inset-y-0 left-0 w-1/4 rounded-full bg-gradient-to-r from-[#FF6B35] to-[#00D4FF]" style={{ animation: "progress 1.5s ease-in-out infinite" }} />
        </div>
      </div>

      {/* Skeleton cards */}
      {[0, 1, 2].map((i) => (
        <div key={i} className={`rounded-2xl border p-5 ${
          isDark ? "border-[rgba(0,212,255,0.06)] bg-[#1A1F2E]/40" : "border-gray-100 bg-white shadow-sm"
        }`}>
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
