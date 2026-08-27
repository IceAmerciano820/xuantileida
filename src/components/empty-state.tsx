interface EmptyStateProps {
  variant?: "initial" | "no-results" | "error";
  message?: string;
  onKeywordClick?: (keyword: string) => void;
  onRetry?: () => void;
}

const RECOMMENDED_KEYWORDS = ["AI工具", "副业", "搞钱"];

export function EmptyState({ variant = "initial", message, onKeywordClick, onRetry }: EmptyStateProps) {
  if (variant === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgba(255,77,106,0.15)] bg-[rgba(255,77,106,0.06)]">
          <svg className="h-8 w-8 text-[#FF4D6A]/70" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h3 className="mb-1.5 text-base font-medium text-white/80">
          {message || "网络异常，请稍后重试"}
        </h3>
        <p className="mb-5 max-w-sm text-sm text-[#8B92A8]">
          可能是网络连接不稳定或服务暂时不可用
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-xl border border-[#00D4FF]/30 bg-transparent px-5 py-2.5 text-sm font-medium text-[#00D4FF] transition-all hover:border-[#00D4FF]/50 hover:bg-[#00D4FF]/5 hover:shadow-[0_0_12px_rgba(0,212,255,0.15)]"
          >
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
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgba(0,212,255,0.08)] bg-[#1A1F2E]/60">
          <svg className="h-8 w-8 text-[#8B92A8]/40" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>
        <h3 className="mb-1.5 text-base font-medium text-white/80">暂无相关热点</h3>
        <p className="mb-5 max-w-sm text-sm text-[#8B92A8]">
          {message || "换个关键词试试"}
        </p>
        {/* Recommended keywords */}
        {onKeywordClick && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-[#8B92A8]/60">试试：</span>
            {RECOMMENDED_KEYWORDS.map((kw) => (
              <button
                key={kw}
                type="button"
                onClick={() => onKeywordClick(kw)}
                className="rounded-full border border-[rgba(0,212,255,0.2)] bg-[#1A1F2E]/60 px-3 py-1 text-xs text-[#8B92A8] transition-all hover:border-[#00D4FF]/40 hover:text-[#00D4FF]"
              >
                {kw}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgba(0,212,255,0.12)] bg-[#1A1F2E]/60">
        <svg className="h-8 w-8 text-[#00D4FF]/50" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6V7.5Z" />
        </svg>
      </div>
      <h3 className="mb-1.5 text-base font-medium text-white/80">输入关键词，开始采集热点</h3>
      <p className="max-w-sm text-sm text-[#8B92A8]">
        输入你感兴趣的话题关键词，工具会自动搜索全网热点内容，并为你提供内容创作切入角度建议
      </p>
    </div>
  );
}
