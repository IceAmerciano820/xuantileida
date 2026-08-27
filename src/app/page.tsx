"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { SearchInput } from "@/components/search-input";
import { ResultCard } from "@/components/result-card";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";

export interface TopicAngle {
  id: string;
  title: string;
  source: string;
  url: string;
  snippet: string;
  heatScore: number;
  heatLevel: "high" | "medium" | "low";
  publishTime: string;
  angles: string[];
}

export interface SearchResponse {
  keyword: string;
  topics: TopicAngle[];
  totalFound?: number;
  message?: string;
}

type TimeRange = "6h" | "1d" | "7d";

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "6h", label: "近6小时" },
  { value: "1d", label: "近24小时" },
  { value: "7d", label: "近7天" },
];

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  "6h": "近6小时",
  "1d": "近24小时",
  "7d": "近7天",
};

const SUGGESTED_KEYWORDS = ["搞钱", "副业", "AI工具", "自媒体", "效率提升", "职场"];
const HISTORY_KEY = "hotspot_search_history";
const MAX_HISTORY = 8;

function loadHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item: unknown): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function saveHistory(history: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch {
    // ignore
  }
}

export default function Home() {
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [searchedKeyword, setSearchedKeyword] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>("1d");
  const [history, setHistory] = useState<string[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Load history on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Close export dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const addToHistory = useCallback((kw: string) => {
    setHistory(prev => {
      const filtered = prev.filter(item => item !== kw);
      const next = [kw, ...filtered].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, []);

  const handleSearch = useCallback(async (kw: string) => {
    const trimmed = kw.trim();
    if (!trimmed) {
      setInputError("请输入话题关键词再采集");
      return;
    }

    setInputError(null);
    setNetworkError(null);
    setLoading(true);
    setResults(null);
    setSearchedKeyword(trimmed);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: trimmed, timeRange }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `请求失败 (${response.status})`);
      }

      const data: SearchResponse = await response.json();
      setResults(data);
      if (data.topics.length > 0) {
        addToHistory(trimmed);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("Failed to fetch") || message.includes("NetworkError") || !message) {
        setNetworkError("网络异常，请稍后重试");
      } else {
        setNetworkError(message || "搜索服务暂时不可用，请稍后重试");
      }
    } finally {
      setLoading(false);
    }
  }, [timeRange, addToHistory]);

  const handleSubmit = useCallback(() => {
    handleSearch(keyword);
  }, [handleSearch, keyword]);

  const handleKeywordClick = useCallback((kw: string) => {
    setKeyword(kw);
    setInputError(null);
    handleSearch(kw);
  }, [handleSearch]);

  const handleKeywordFill = useCallback((kw: string) => {
    setKeyword(kw);
    setInputError(null);
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  // Export functions
  const buildExportText = useCallback(() => {
    if (!results || results.topics.length === 0) return "";
    const lines: string[] = [
      `热点灵感采集 - 「${searchedKeyword}」`,
      `时间范围: ${TIME_RANGE_LABELS[timeRange]}`,
      `采集时间: ${new Date().toLocaleString("zh-CN")}`,
      `共 ${results.topics.length} 条热点`,
      "=".repeat(50),
      "",
    ];

    results.topics.forEach((topic, i) => {
      lines.push(`#${i + 1} ${topic.title}`);
      lines.push(`来源: ${topic.source} | 热度: ${topic.heatScore} | 时间: ${topic.publishTime}`);
      if (topic.url) lines.push(`链接: ${topic.url}`);
      if (topic.snippet) lines.push(`摘要: ${topic.snippet}`);
      lines.push("");
      lines.push("创作切入角度:");
      topic.angles.forEach((angle, j) => {
        lines.push(`  ${j + 1}. ${angle}`);
      });
      lines.push("");
      lines.push("-".repeat(40));
      lines.push("");
    });

    return lines.join("\n");
  }, [results, searchedKeyword, timeRange]);

  const handleCopyAll = useCallback(async () => {
    const text = buildExportText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setShowExportMenu(false);
    } catch {
      // fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setShowExportMenu(false);
    }
  }, [buildExportText]);

  const handleDownloadTxt = useCallback(() => {
    const text = buildExportText();
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `热点采集_${searchedKeyword}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [buildExportText, searchedKeyword]);

  const hasResults = results && results.topics.length > 0;
  const hasNoResults = results && results.topics.length === 0;

  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAF9]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[#E7E5E4] bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
            <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-[#1C1917]">热点灵感采集</h1>
            <p className="hidden text-xs text-[#78716C] sm:block">发现热门话题，获取创作灵感</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-5 sm:px-6 sm:py-8">
        {/* Search Section */}
        <section className="mb-6 rounded-xl border border-[#E7E5E4] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <SearchInput
                value={keyword}
                onChange={setKeyword}
                onSubmit={handleSubmit}
                loading={loading}
                error={inputError}
              />
            </div>
            {/* Time Range Selector */}
            <div className="relative shrink-0">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                disabled={loading}
                className="h-11 w-full appearance-none rounded-xl border border-[#E7E5E4] bg-white py-2 pl-3 pr-8 text-sm text-[#57534E] outline-none transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:opacity-60 sm:w-auto"
              >
                {TIME_RANGE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8A29E]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>

          {/* Suggested Keywords */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#A8A29E]">试试：</span>
            {SUGGESTED_KEYWORDS.map((kw) => (
              <button
                key={kw}
                type="button"
                onClick={() => handleKeywordFill(kw)}
                disabled={loading}
                className="rounded-full border border-[#E7E5E4] bg-[#FAFAF9] px-3 py-1 text-xs text-[#57534E] transition-all hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 active:scale-95 disabled:opacity-50"
              >
                {kw}
              </button>
            ))}
          </div>

          {/* Search History */}
          {history.length > 0 && !loading && !results && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#F5F5F4] pt-3">
              <span className="text-xs text-[#A8A29E]">历史：</span>
              {history.map((kw) => (
                <button
                  key={kw}
                  type="button"
                  onClick={() => handleKeywordClick(kw)}
                  disabled={loading}
                  className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-[#78716C] transition-all hover:bg-stone-200 active:scale-95"
                >
                  {kw}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClearHistory}
                className="text-xs text-[#A8A29E] transition-colors hover:text-[#78716C]"
              >
                清除
              </button>
            </div>
          )}
        </section>

        {/* Loading State */}
        {loading && <LoadingSkeleton />}

        {/* Network Error */}
        {networkError && !loading && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-center">
            <div className="mb-2 flex items-center justify-center gap-2">
              <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              <p className="text-sm font-medium text-red-600">{networkError}</p>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              className="text-xs text-red-500 underline decoration-red-200 underline-offset-2 hover:text-red-700"
            >
              点击重试
            </button>
          </div>
        )}

        {/* No Results */}
        {hasNoResults && !loading && (
          <EmptyState variant="no-results" message={results.message} />
        )}

        {/* Initial Empty State */}
        {!loading && !results && !networkError && <EmptyState variant="initial" />}

        {/* Results */}
        {hasResults && (
          <section>
            {/* Results Header */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[#78716C]">
                找到{" "}
                <span className="font-medium text-[#1C1917]">
                  {results.totalFound ?? results.topics.length}
                </span>{" "}
                条与「{searchedKeyword}」相关的热点
                <span className="ml-1.5 text-xs text-[#A8A29E]">{TIME_RANGE_LABELS[timeRange]}</span>
              </p>
              {/* Export Button */}
              <div className="relative" ref={exportRef}>
                <button
                  type="button"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E7E5E4] bg-white px-3 py-1.5 text-xs text-[#57534E] transition-all hover:border-amber-300 hover:bg-amber-50"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  导出
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border border-[#E7E5E4] bg-white shadow-lg">
                    <button
                      type="button"
                      onClick={handleCopyAll}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#44403C] transition-colors hover:bg-[#FAFAF9]"
                    >
                      <svg className="h-4 w-4 text-[#78716C]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                      </svg>
                      复制全部
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadTxt}
                      className="flex w-full items-center gap-2 border-t border-[#F5F5F4] px-3 py-2 text-left text-sm text-[#44403C] transition-colors hover:bg-[#FAFAF9]"
                    >
                      <svg className="h-4 w-4 text-[#78716C]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      下载 TXT
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Result Cards - scrollable */}
            <div className="space-y-3">
              {results.topics.map((topic, index) => (
                <ResultCard key={topic.id} topic={topic} index={index} />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer - de-emphasized */}
      <footer className="py-3">
        <p className="text-center text-[11px] text-[#D6D3D1]">
          数据来源：全网公开热点信息聚合 | 仅供选题参考
        </p>
      </footer>
    </div>
  );
}
