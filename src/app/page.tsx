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
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setShowMobileMenu(false);
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
    setShowMobileMenu(false);
    setShowHistoryPanel(false);

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
    <div className="flex min-h-screen flex-col bg-[#0A0E1A]">
      {/* Header / Toolbar */}
      <header className="sticky top-0 z-20 border-b border-[rgba(0,212,255,0.08)] bg-[#0A0E1A]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00D4FF]/10">
              <svg className="h-4.5 w-4.5 text-[#00D4FF]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
              </svg>
            </div>
            <h1 className="text-base font-bold tracking-tight text-white">热点灵感</h1>
          </div>

          {/* Desktop toolbar */}
          <div className="hidden items-center gap-2 sm:flex">
            {/* Time range */}
            <div className="relative">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                disabled={loading}
                className="h-8 appearance-none rounded-lg border border-[rgba(0,212,255,0.12)] bg-[#12162A] py-1.5 pl-2.5 pr-7 text-xs text-[#8B92A8] outline-none transition-all focus:border-[#00D4FF]/40 disabled:opacity-50"
              >
                {TIME_RANGE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8B92A8]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </div>

            {/* Export */}
            {hasResults && (
              <div className="relative" ref={exportRef}>
                <button
                  type="button"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[rgba(0,212,255,0.12)] bg-[#12162A] px-2.5 text-xs text-[#8B92A8] transition-all hover:border-[#00D4FF]/30 hover:text-white"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  导出
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full z-30 mt-1.5 w-36 overflow-hidden rounded-xl border border-[rgba(0,212,255,0.12)] bg-[#1A1F2E] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                    <button
                      type="button"
                      onClick={handleCopyAll}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-[#8B92A8] transition-colors hover:bg-[#252B3D] hover:text-white"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                      </svg>
                      复制全部
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadTxt}
                      className="flex w-full items-center gap-2 border-t border-[rgba(0,212,255,0.06)] px-3 py-2.5 text-left text-xs text-[#8B92A8] transition-colors hover:bg-[#252B3D] hover:text-white"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      下载 TXT
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* History button */}
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-all ${
                  showHistoryPanel
                    ? "border-[#00D4FF]/30 bg-[#00D4FF]/10 text-[#00D4FF]"
                    : "border-[rgba(0,212,255,0.12)] bg-[#12162A] text-[#8B92A8] hover:border-[#00D4FF]/30 hover:text-white"
                }`}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                历史
              </button>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="relative sm:hidden" ref={mobileMenuRef}>
            <button
              type="button"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[rgba(0,212,255,0.12)] bg-[#12162A] text-[#8B92A8] transition-colors hover:text-white"
            >
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                {showMobileMenu ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                )}
              </svg>
            </button>
            {showMobileMenu && (
              <div className="absolute right-0 top-full z-30 mt-1.5 w-44 overflow-hidden rounded-xl border border-[rgba(0,212,255,0.12)] bg-[#1A1F2E] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                {/* Time range in mobile */}
                <div className="border-b border-[rgba(0,212,255,0.06)] px-3 py-2.5">
                  <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[#8B92A8]/60">时间范围</p>
                  <div className="flex gap-1.5">
                    {TIME_RANGE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setTimeRange(opt.value); }}
                        className={`rounded-md px-2.5 py-1 text-xs transition-all ${
                          timeRange === opt.value
                            ? "bg-[#00D4FF]/15 font-medium text-[#00D4FF]"
                            : "text-[#8B92A8] hover:bg-[#252B3D]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Export in mobile */}
                {hasResults && (
                  <>
                    <button type="button" onClick={handleCopyAll} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-[#8B92A8] hover:bg-[#252B3D] hover:text-white">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" /></svg>
                      复制全部
                    </button>
                    <button type="button" onClick={handleDownloadTxt} className="flex w-full items-center gap-2 border-t border-[rgba(0,212,255,0.06)] px-3 py-2.5 text-left text-xs text-[#8B92A8] hover:bg-[#252B3D] hover:text-white">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                      下载 TXT
                    </button>
                  </>
                )}
                {/* History in mobile */}
                {history.length > 0 && (
                  <div className="border-t border-[rgba(0,212,255,0.06)] px-3 py-2.5">
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-wider text-[#8B92A8]/60">历史搜索</p>
                      <button type="button" onClick={handleClearHistory} className="text-[10px] text-[#8B92A8] hover:text-[#FF4D6A]">清除</button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {history.map((kw) => (
                        <button key={kw} type="button" onClick={() => handleKeywordClick(kw)} className="rounded-md bg-[#252B3D] px-2 py-0.5 text-[11px] text-[#8B92A8] transition-colors hover:bg-[#00D4FF]/10 hover:text-[#00D4FF]">
                          {kw}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-5 sm:px-6 sm:py-8">
        {/* History panel (desktop, inline) */}
        {showHistoryPanel && history.length > 0 && !loading && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[rgba(0,212,255,0.08)] bg-[#12162A]/60 p-3 backdrop-blur-xl">
            <span className="text-xs text-[#8B92A8]/60">历史：</span>
            {history.map((kw) => (
              <button
                key={kw}
                type="button"
                onClick={() => handleKeywordClick(kw)}
                className="rounded-md bg-[#252B3D] px-2.5 py-1 text-xs text-[#8B92A8] transition-all hover:bg-[#00D4FF]/10 hover:text-[#00D4FF] active:scale-95"
              >
                {kw}
              </button>
            ))}
            <button type="button" onClick={handleClearHistory} className="ml-auto text-xs text-[#8B92A8]/50 transition-colors hover:text-[#FF4D6A]">清除</button>
          </div>
        )}

        {/* Search Section */}
        <section className="mb-6 rounded-2xl border border-[rgba(0,212,255,0.08)] bg-[#12162A]/50 p-4 backdrop-blur-xl sm:p-5">
          <SearchInput
            value={keyword}
            onChange={setKeyword}
            onSubmit={handleSubmit}
            loading={loading}
            error={inputError}
          />

          {/* Suggested Keywords */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#8B92A8]/50">试试：</span>
            {SUGGESTED_KEYWORDS.map((kw) => (
              <button
                key={kw}
                type="button"
                onClick={() => handleKeywordFill(kw)}
                disabled={loading}
                className="rounded-full border border-[rgba(0,212,255,0.12)] bg-transparent px-3 py-1 text-xs text-[#8B92A8] transition-all hover:border-[#00D4FF]/40 hover:bg-[#00D4FF]/10 hover:text-[#00D4FF] active:scale-95 disabled:opacity-40"
              >
                {kw}
              </button>
            ))}
          </div>
        </section>

        {/* Loading State */}
        {loading && <LoadingSkeleton />}

        {/* Network Error */}
        {networkError && !loading && (
          <div className="rounded-2xl border border-[rgba(255,77,106,0.15)] bg-[rgba(255,77,106,0.05)] p-4 text-center backdrop-blur-xl">
            <div className="mb-2 flex items-center justify-center gap-2">
              <svg className="h-4 w-4 text-[#FF4D6A]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              <p className="text-sm font-medium text-[#FF4D6A]">{networkError}</p>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              className="text-xs text-[#FF4D6A]/70 underline decoration-[#FF4D6A]/20 underline-offset-2 transition-colors hover:text-[#FF4D6A]"
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
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-[#8B92A8]">
                找到{" "}
                <span className="font-medium text-white">
                  {results.totalFound ?? results.topics.length}
                </span>{" "}
                条与「{searchedKeyword}」相关的热点
                <span className="ml-1.5 text-xs text-[#8B92A8]/50">{TIME_RANGE_LABELS[timeRange]}</span>
              </p>
            </div>

            {/* Result Cards */}
            <div className="space-y-3">
              {results.topics.map((topic, index) => (
                <ResultCard key={topic.id} topic={topic} index={index} />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="py-3">
        <p className="text-center text-[11px] text-[#8B92A8]/30">
          数据来源：全网公开热点信息聚合 | 仅供选题参考
        </p>
      </footer>
    </div>
  );
}
