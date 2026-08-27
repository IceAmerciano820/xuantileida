"use client";

import { useTheme } from "@/hooks/use-theme";

interface EmptyStateProps {
  variant?: "initial" | "no-results" | "error";
  message?: string;
  onKeywordClick?: (keyword: string) => void;
  onRetry?: () => void;
}

const RECOMMENDED_KEYWORDS = ["AI工具", "副业", "搞钱"];

export function EmptyState({ variant = "initial", message, onKeywordClick, onRetry }: EmptyStateProps) {
  const { isDark } = useTheme();

  if (variant === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border ${
          isDark ? "border-[rgba(255,77,106,0.15)] bg-[rgba(255,77,106,0.06)]" : "border-red-100 bg-red-50"
        }`}>
          <svg className="h-8 w-8 text-[#FF4D6A]/70" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h3 className={`mb-1.5 text-base font-medium ${isDark ? "text-white/80" : "text-gray-700"}`}>
          {message || "网络异常，请稍后重试"}
        </h3>
        <p className={`mb-5 max-w-sm text-sm ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>
          可能是网络连接不稳定或服务暂时不可用
        </p>
        {onRetry && (
          <button type="button" onClick={onRetry} className={`inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium transition-all ${
            isDark
              ? "border-[#00D4FF]/30 text-[#00D4FF] hover:border-[#00D4FF]/50 hover:bg-[#00D4FF]/5 hover:shadow-[0_0_12px_rgba(0,212,255,0.15)]"
              : "border-[#00B4D8]/30 text-[#00B4D8] hover:border-[#00B4D8]/50 hover:bg-blue-50"
          }`}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
            </svg>
            重新采集
          </button>
        )}
      </div>
    );
  }

  if (variant === "no-results") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border ${
          isDark ? "border-[rgba(0,212,255,0.08)] bg-[#1A1F2E]/60" : "border-gray-200 bg-gray-50"
        }`}>
          <svg className={`h-8 w-8 ${isDark ? "text-[#8B92A8]/40" : "text-gray-300"}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>
        <h3 className={`mb-1.5 text-base font-medium ${isDark ? "text-white/80" : "text-gray-700"}`}>暂无相关热点</h3>
        <p className={`mb-5 max-w-sm text-sm ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>{message || "换个关键词试试"}</p>
        {onKeywordClick && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className={`text-xs ${isDark ? "text-[#8B92A8]/60" : "text-gray-400"}`}>试试：</span>
            {RECOMMENDED_KEYWORDS.map((kw) => (
              <button key={kw} type="button" onClick={() => onKeywordClick(kw)} className={`rounded-full border px-3 py-1 text-xs transition-all active:scale-95 ${
                isDark
                  ? "border-[rgba(0,212,255,0.15)] text-[#8B92A8] hover:border-[#00D4FF]/40 hover:bg-[#00D4FF]/10 hover:text-[#00D4FF]"
                  : "border-gray-200 text-gray-500 hover:border-[#00B4D8]/40 hover:bg-blue-50 hover:text-[#00B4D8]"
              }`}>{kw}</button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Initial state
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className={`mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border ${
        isDark ? "border-[rgba(0,212,255,0.08)] bg-[#12162A]/40" : "border-gray-200 bg-gray-50"
      }`}>
        <svg className={`h-10 w-10 ${isDark ? "text-[#00D4FF]/30" : "text-[#00B4D8]/30"}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-1.5m-12 0H4.5m15-6.5-1.06 1.06M6.56 17.44l-1.06 1.06m0-13l1.06 1.06M17.44 17.44l1.06 1.06" />
        </svg>
      </div>
      <h2 className={`mb-2 text-lg font-semibold ${isDark ? "text-white/90" : "text-gray-800"}`}>发现热点灵感</h2>
      <p className={`max-w-xs text-sm leading-relaxed ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>
        输入你感兴趣的话题关键词，自动采集全网热点数据，<br />为内容创作提供切入角度建议
      </p>
    </div>
  );
}
