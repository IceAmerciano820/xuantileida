"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { ThemeProvider, useTheme } from "@/hooks/use-theme";
import { SearchInput } from "@/components/search-input";
import { ResultCard } from "@/components/result-card";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { HeatTrendChart } from "@/components/heat-trend-chart";
import { GenerateContentModal } from "@/components/generate-content-modal";
import { FavoritesModal } from "@/components/favorites-modal";

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
type SortBy = "latest" | "hottest";
type ContentType = "xiaohongshu" | "douyin" | "gongzhonghao";

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "6h", label: "近6小时" },
  { value: "1d", label: "近24小时" },
  { value: "7d", label: "近7天" },
];
const TIME_RANGE_LABELS: Record<TimeRange, string> = { "6h": "近6小时", "1d": "近24小时", "7d": "近7天" };

const PLATFORM_FILTERS = ["全部", "抖音", "小红书", "微博", "百度", "知乎"];
const HOT_KEYWORDS = ["AI工具", "副业", "搞钱", "减肥", "护肤", "职场", "育儿", "考研", "买房", "理财"];

const HISTORY_KEY = "hotspot_search_history";
const FAVORITES_KEY = "hotspot_favorites";
const MAX_HISTORY = 10;

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch { return fallback; }
}

function saveToStorage(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function InnerApp() {
  const { isDark } = useTheme();

  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [searchedKeyword, setSearchedKeyword] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>("1d");
  const [history, setHistory] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<TopicAngle[]>([]);
  const [platformFilter, setPlatformFilter] = useState("全部");
  const [sortBy, setSortBy] = useState<SortBy>("latest");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [generateTarget, setGenerateTarget] = useState<TopicAngle | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Load from localStorage
  useEffect(() => {
    setHistory(loadFromStorage<string[]>(HISTORY_KEY, []));
    setFavorites(loadFromStorage<TopicAngle[]>(FAVORITES_KEY, []));
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExportMenu(false);
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) setShowMobileMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const addToHistory = useCallback((kw: string) => {
    setHistory(prev => {
      const next = [kw, ...prev.filter(item => item !== kw)].slice(0, MAX_HISTORY);
      saveToStorage(HISTORY_KEY, next);
      return next;
    });
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    saveToStorage(HISTORY_KEY, []);
  }, []);

  const handleSearch = useCallback(async (kw: string) => {
    const trimmed = kw.trim();
    if (!trimmed) { setInputError("请输入话题关键词再采集"); return; }
    setInputError(null);
    setNetworkError(null);
    setLoading(true);
    setResults(null);
    setSearchedKeyword(trimmed);
    setPlatformFilter("全部");
    setSortBy("latest");
    setShowMobileMenu(false);

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
      if (data.topics.length > 0) addToHistory(trimmed);
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

  const handleSubmit = useCallback(() => { handleSearch(keyword); }, [handleSearch, keyword]);
  const handleKeywordClick = useCallback((kw: string) => { setKeyword(kw); setInputError(null); handleSearch(kw); }, [handleSearch]);
  const handleKeywordFill = useCallback((kw: string) => { setKeyword(kw); setInputError(null); }, []);

  // Favorites
  const handleToggleFavorite = useCallback((topic: TopicAngle) => {
    setFavorites(prev => {
      const exists = prev.some(f => f.id === topic.id);
      const next = exists ? prev.filter(f => f.id !== topic.id) : [topic, ...prev];
      saveToStorage(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  const handleRemoveFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const next = prev.filter(f => f.id !== id);
      saveToStorage(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  const handleClearFavorites = useCallback(() => {
    setFavorites([]);
    saveToStorage(FAVORITES_KEY, []);
  }, []);

  // Filtered and sorted results
  const displayedTopics = useMemo(() => {
    if (!results) return [];
    let filtered = results.topics;
    if (platformFilter !== "全部") {
      filtered = filtered.filter(t => t.source.includes(platformFilter));
    }
    const sorted = [...filtered];
    if (sortBy === "latest") {
      sorted.sort((a, b) => new Date(b.publishTime).getTime() - new Date(a.publishTime).getTime());
    } else {
      sorted.sort((a, b) => b.heatScore - a.heatScore);
    }
    return sorted;
  }, [results, platformFilter, sortBy]);

  const isFavorited = useCallback((id: string) => favorites.some(f => f.id === id), [favorites]);

  // Export functions
  const buildExportText = useCallback(() => {
    if (!results || displayedTopics.length === 0) return "";
    const lines: string[] = [
      `热点灵感采集 - 「${searchedKeyword}」`,
      `时间范围: ${TIME_RANGE_LABELS[timeRange]}`,
      `采集时间: ${new Date().toLocaleString("zh-CN")}`,
      `共 ${displayedTopics.length} 条热点`,
      "=".repeat(50), "",
    ];
    displayedTopics.forEach((topic, i) => {
      lines.push(`#${i + 1} ${topic.title}`);
      lines.push(`来源: ${topic.source} | 热度: ${topic.heatScore} | 时间: ${topic.publishTime}`);
      if (topic.url) lines.push(`链接: ${topic.url}`);
      lines.push("");
      lines.push("创作切入角度:");
      topic.angles.forEach((angle, j) => { lines.push(`  ${j + 1}. ${angle}`); });
      lines.push("");
      lines.push("-".repeat(40));
      lines.push("");
    });
    return lines.join("\n");
  }, [results, displayedTopics, searchedKeyword, timeRange]);

  const buildMarkdown = useCallback(() => {
    if (!results || displayedTopics.length === 0) return "";
    const lines: string[] = [
      `# 热点灵感采集 - 「${searchedKeyword}」`,
      "",
      `> 时间范围: ${TIME_RANGE_LABELS[timeRange]} | 采集时间: ${new Date().toLocaleString("zh-CN")} | 共 ${displayedTopics.length} 条`,
      "",
    ];
    displayedTopics.forEach((topic, i) => {
      lines.push(`## ${i + 1}. ${topic.title}`);
      lines.push("");
      lines.push(`- **来源**: ${topic.source}`);
      lines.push(`- **热度**: ${topic.heatScore}`);
      lines.push(`- **时间**: ${topic.publishTime}`);
      if (topic.url) lines.push(`- **链接**: [查看原文](${topic.url})`);
      lines.push("");
      lines.push("### 创作切入角度");
      lines.push("");
      topic.angles.forEach((angle, j) => { lines.push(`${j + 1}. ${angle}`); });
      lines.push("");
      lines.push("---");
      lines.push("");
    });
    return lines.join("\n");
  }, [results, displayedTopics, searchedKeyword, timeRange]);

  const handleCopyAll = useCallback(async () => {
    const text = buildExportText();
    if (!text) return;
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
    }
    setShowExportMenu(false);
  }, [buildExportText]);

  const handleExportMarkdown = useCallback(() => {
    const md = buildMarkdown();
    if (!md) return;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `热点采集_${searchedKeyword}_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [buildMarkdown, searchedKeyword]);

  const handleExportPDF = useCallback(() => {
    setShowExportMenu(false);
    window.print();
  }, []);

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
    <div className={`flex min-h-screen flex-col transition-colors duration-300 ${isDark ? "bg-[#0A0E1A]" : "bg-[#FAFAFA]"}`}>
      {/* Header */}
      <header className={`sticky top-0 z-20 border-b backdrop-blur-xl no-print ${
        isDark ? "border-[rgba(0,212,255,0.08)] bg-[#0A0E1A]/90" : "border-gray-200 bg-white/90"
      }`}>
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isDark ? "bg-[#00D4FF]/10" : "bg-[#00B4D8]/10"}`}>
              <svg className={`h-4.5 w-4.5 ${isDark ? "text-[#00D4FF]" : "text-[#00B4D8]"}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
              </svg>
            </div>
            <h1 className={`text-lg font-bold tracking-tight ${isDark ? "bg-gradient-to-r from-[#00D4FF] to-[#0066FF] bg-clip-text text-transparent" : "text-gray-900"}`}>
              热点灵感
            </h1>
          </div>

          {/* Desktop toolbar */}
          <div className="hidden items-center gap-2 sm:flex">
            {/* Time range */}
            <div className="relative">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                disabled={loading}
                className={`h-8 appearance-none rounded-lg border py-1.5 pl-2.5 pr-7 text-xs outline-none transition-all focus:border-[#00D4FF]/40 disabled:opacity-50 ${
                  isDark ? "border-[rgba(0,212,255,0.12)] bg-[#12162A] text-[#8B92A8]" : "border-gray-200 bg-white text-gray-600"
                }`}
              >
                {TIME_RANGE_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
              </select>
              <svg className={`pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? "text-[#8B92A8]" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </div>

            {/* Favorites button */}
            <button type="button" onClick={() => setShowFavorites(true)} className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-all ${
              isDark ? "border-[rgba(0,212,255,0.12)] bg-[#12162A] text-[#8B92A8] hover:border-[#00D4FF]/30 hover:text-white" : "border-gray-200 bg-white text-gray-600 hover:border-[#00B4D8]/30 hover:text-gray-900"
            }`}>
              <svg className="h-3.5 w-3.5" fill={favorites.length > 0 ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={favorites.length > 0 ? 0 : 1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.06.472 1.736 1.55 1.736 2.74v13.876c0 1.19-.676 2.268-1.736 2.74l-7.5 3.33a.75.75 0 0 1-.612 0l-7.5-3.33c-1.06-.472-1.736-1.55-1.736-2.74V6.062c0-1.19.676-2.268 1.736-2.74l7.5-3.33a.75.75 0 0 1 .612 0l7.5 3.33Z" />
              </svg>
              灵感库{favorites.length > 0 && <span className="text-[#00D4FF]">({favorites.length})</span>}
            </button>

            {/* Export */}
            {hasResults && (
              <div className="relative" ref={exportRef}>
                <button type="button" onClick={() => setShowExportMenu(!showExportMenu)} className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-all ${
                  isDark ? "border-[rgba(0,212,255,0.12)] bg-[#12162A] text-[#8B92A8] hover:border-[#00D4FF]/30 hover:text-white" : "border-gray-200 bg-white text-gray-600 hover:border-[#00B4D8]/30 hover:text-gray-900"
                }`}>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                  导出
                </button>
                {showExportMenu && (
                  <div className={`absolute right-0 top-full z-30 mt-1.5 w-40 overflow-hidden rounded-xl border shadow-2xl ${
                    isDark ? "border-[rgba(0,212,255,0.12)] bg-[#1A1F2E]" : "border-gray-200 bg-white"
                  }`}>
                    <button type="button" onClick={handleCopyAll} className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs transition-colors ${isDark ? "text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}>复制全部</button>
                    <button type="button" onClick={handleExportMarkdown} className={`flex w-full items-center gap-2 border-t px-3 py-2.5 text-left text-xs transition-colors ${isDark ? "border-[rgba(0,212,255,0.06)] text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "border-gray-100 text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}>导出 Markdown</button>
                    <button type="button" onClick={handleExportPDF} className={`flex w-full items-center gap-2 border-t px-3 py-2.5 text-left text-xs transition-colors ${isDark ? "border-[rgba(0,212,255,0.06)] text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "border-gray-100 text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}>导出 PDF</button>
                    <button type="button" onClick={handleDownloadTxt} className={`flex w-full items-center gap-2 border-t px-3 py-2.5 text-left text-xs transition-colors ${isDark ? "border-[rgba(0,212,255,0.06)] text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "border-gray-100 text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}>下载 TXT</button>
                  </div>
                )}
              </div>
            )}

            {/* Theme toggle */}
            <ThemeToggle />
          </div>

          {/* Mobile hamburger */}
          <div className="relative flex items-center gap-2 sm:hidden">
            <ThemeToggle />
            <div ref={mobileMenuRef}>
              <button type="button" onClick={() => setShowMobileMenu(!showMobileMenu)} className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                isDark ? "border-[rgba(0,212,255,0.12)] bg-[#12162A] text-[#8B92A8]" : "border-gray-200 bg-white text-gray-600"
              }`}>
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  {showMobileMenu
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />}
                </svg>
              </button>
              {showMobileMenu && (
                <div className={`absolute right-0 top-full z-30 mt-1.5 w-52 overflow-hidden rounded-xl border shadow-2xl ${
                  isDark ? "border-[rgba(0,212,255,0.12)] bg-[#1A1F2E]" : "border-gray-200 bg-white"
                }`}>
                  <div className={`border-b px-3 py-2.5 ${isDark ? "border-[rgba(0,212,255,0.06)]" : "border-gray-100"}`}>
                    <p className={`mb-1.5 text-[10px] uppercase tracking-wider ${isDark ? "text-[#8B92A8]/60" : "text-gray-400"}`}>时间范围</p>
                    <div className="flex gap-1.5">
                      {TIME_RANGE_OPTIONS.map(opt => (
                        <button key={opt.value} type="button" onClick={() => setTimeRange(opt.value)} className={`rounded-md px-2.5 py-1 text-xs transition-all ${
                          timeRange === opt.value
                            ? (isDark ? "bg-[#00D4FF]/15 font-medium text-[#00D4FF]" : "bg-[#00B4D8]/15 font-medium text-[#00B4D8]")
                            : (isDark ? "text-[#8B92A8] hover:bg-[#252B3D]" : "text-gray-600 hover:bg-gray-100")
                        }`}>{opt.label}</button>
                      ))}
                    </div>
                  </div>
                  <button type="button" onClick={() => { setShowFavorites(true); setShowMobileMenu(false); }} className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs transition-colors ${isDark ? "text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "text-gray-600 hover:bg-gray-50"}`}>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.06.472 1.736 1.55 1.736 2.74v13.876c0 1.19-.676 2.268-1.736 2.74l-7.5 3.33a.75.75 0 0 1-.612 0l-7.5-3.33c-1.06-.472-1.736-1.55-1.736-2.74V6.062c0-1.19.676-2.268 1.736-2.74l7.5-3.33a.75.75 0 0 1 .612 0l7.5 3.33Z" /></svg>
                    灵感库 ({favorites.length})
                  </button>
                  {hasResults && (
                    <>
                      <button type="button" onClick={() => { handleCopyAll(); setShowMobileMenu(false); }} className={`flex w-full items-center gap-2 border-t px-3 py-2.5 text-left text-xs ${isDark ? "border-[rgba(0,212,255,0.06)] text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "border-gray-100 text-gray-600 hover:bg-gray-50"}`}>复制全部</button>
                      <button type="button" onClick={() => { handleExportMarkdown(); setShowMobileMenu(false); }} className={`flex w-full items-center gap-2 border-t px-3 py-2.5 text-left text-xs ${isDark ? "border-[rgba(0,212,255,0.06)] text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "border-gray-100 text-gray-600 hover:bg-gray-50"}`}>导出 Markdown</button>
                      <button type="button" onClick={() => { handleExportPDF(); setShowMobileMenu(false); }} className={`flex w-full items-center gap-2 border-t px-3 py-2.5 text-left text-xs ${isDark ? "border-[rgba(0,212,255,0.06)] text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "border-gray-100 text-gray-600 hover:bg-gray-50"}`}>导出 PDF</button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Gradient banner */}
      <div className="h-1 w-full bg-gradient-to-r from-[#FF6B35] via-[#FF8C42] to-[#00D4FF] no-print" />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-5 sm:px-6 sm:py-8">
        {/* Search Section */}
        <section className={`mb-5 rounded-2xl border p-4 backdrop-blur-xl sm:p-5 no-print ${
          isDark ? "border-[rgba(0,212,255,0.08)] bg-[#12162A]/50" : "border-gray-200 bg-white shadow-sm"
        }`}>
          <SearchInput value={keyword} onChange={setKeyword} onSubmit={handleSubmit} loading={loading} error={inputError} />

          {/* History + Recommendations row */}
          <div className="mt-3 space-y-2">
            {/* History */}
            {history.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`text-xs ${isDark ? "text-[#8B92A8]/50" : "text-gray-400"}`}>历史：</span>
                {history.map((kw) => (
                  <button key={kw} type="button" onClick={() => handleKeywordClick(kw)} disabled={loading} className={`rounded-full border px-2.5 py-0.5 text-xs transition-all active:scale-95 disabled:opacity-40 ${
                    isDark
                      ? "border-[rgba(0,212,255,0.15)] text-[#8B92A8] hover:border-[#00D4FF]/40 hover:text-[#00D4FF]"
                      : "border-gray-200 text-gray-500 hover:border-[#00B4D8]/40 hover:text-[#00B4D8]"
                  }`}>{kw}</button>
                ))}
                <button type="button" onClick={handleClearHistory} className="ml-1 text-xs text-[#FF4D6A]/50 transition-colors hover:text-[#FF4D6A]">清空</button>
              </div>
            )}
            {/* Hot recommendations */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`text-xs ${isDark ? "text-[#8B92A8]/50" : "text-gray-400"}`}>热门：</span>
              {HOT_KEYWORDS.map((kw) => (
                <button key={kw} type="button" onClick={() => handleKeywordClick(kw)} disabled={loading} className={`rounded-full border border-dashed px-2.5 py-0.5 text-xs transition-all active:scale-95 disabled:opacity-40 ${
                  isDark
                    ? "border-[rgba(0,212,255,0.12)] text-[#8B92A8]/70 hover:border-[#00D4FF]/30 hover:text-[#00D4FF]"
                    : "border-gray-300 text-gray-400 hover:border-[#00B4D8]/30 hover:text-[#00B4D8]"
                }`}>{kw}</button>
              ))}
            </div>
          </div>
        </section>

        {/* Loading */}
        {loading && <LoadingSkeleton />}

        {/* Error */}
        {networkError && !loading && <EmptyState variant="error" message={networkError} onRetry={handleSubmit} />}

        {/* No Results */}
        {hasNoResults && !loading && <EmptyState variant="no-results" message={results.message} onKeywordClick={handleKeywordClick} />}

        {/* Initial */}
        {!loading && !results && !networkError && <EmptyState variant="initial" />}

        {/* Results */}
        {hasResults && (
          <section>
            {/* Results header */}
            <div className="mb-3 flex items-center justify-between">
              <p className={`text-sm ${isDark ? "text-[#8B92A8]" : "text-gray-600"}`}>
                找到 <span className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>{displayedTopics.length}</span> 条相关热点
                <span className={`ml-1.5 text-xs ${isDark ? "text-[#8B92A8]/50" : "text-gray-400"}`}>{TIME_RANGE_LABELS[timeRange]}</span>
              </p>
            </div>

            {/* Platform filter + Sort */}
            <div className={`mb-4 flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between no-print ${
              isDark ? "border-[rgba(0,212,255,0.08)] bg-[#12162A]/30" : "border-gray-100 bg-white shadow-sm"
            }`}>
              {/* Platform filter */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                {PLATFORM_FILTERS.map((p) => (
                  <button key={p} type="button" onClick={() => setPlatformFilter(p)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    platformFilter === p
                      ? (isDark ? "bg-[#00D4FF] text-[#0A0E1A]" : "bg-[#00B4D8] text-white")
                      : (isDark ? "text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700")
                  }`}>{p}</button>
                ))}
              </div>
              {/* Sort */}
              <div className="flex items-center gap-1">
                <span className={`text-xs ${isDark ? "text-[#8B92A8]/50" : "text-gray-400"}`}>排序：</span>
                {(["latest", "hottest"] as SortBy[]).map((s) => (
                  <button key={s} type="button" onClick={() => setSortBy(s)} className={`rounded-lg px-2.5 py-1 text-xs transition-all ${
                    sortBy === s
                      ? (isDark ? "bg-[#00D4FF]/15 font-medium text-[#00D4FF]" : "bg-[#00B4D8]/10 font-medium text-[#00B4D8]")
                      : (isDark ? "text-[#8B92A8] hover:text-white" : "text-gray-500 hover:text-gray-700")
                  }`}>{s === "latest" ? "最新" : "最热"}</button>
                ))}
              </div>
            </div>

            {/* Heat Trend Chart */}
            <div className="mb-5 no-print">
              <HeatTrendChart keyword={searchedKeyword} data={[]} />
            </div>

            {/* Cards */}
            <div className="space-y-4">
              {displayedTopics.map((topic, index) => (
                <ResultCard
                  key={topic.id}
                  topic={topic}
                  index={index}
                  isFavorited={isFavorited(topic.id)}
                  onToggleFavorite={handleToggleFavorite}
                  onGenerate={setGenerateTarget}
                />
              ))}
            </div>

            {displayedTopics.length === 0 && platformFilter !== "全部" && (
              <div className={`py-12 text-center ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>
                <p className="text-sm">该分类下暂无热点</p>
                <button type="button" onClick={() => setPlatformFilter("全部")} className="mt-2 text-xs text-[#00D4FF] hover:underline">查看全部</button>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="py-3 no-print">
        <p className={`text-center text-[11px] ${isDark ? "text-[#8B92A8]/30" : "text-gray-300"}`}>
          数据来源：全网公开热点信息聚合 | 仅供选题参考
        </p>
      </footer>

      {/* Modals */}
      {generateTarget && (
        <GenerateContentModal
          open={!!generateTarget}
          onClose={() => setGenerateTarget(null)}
          title={generateTarget.title}
          snippet={generateTarget.snippet}
        />
      )}
      <FavoritesModal
        open={showFavorites}
        onClose={() => setShowFavorites(false)}
        favorites={favorites}
        onRemove={handleRemoveFavorite}
        onClear={handleClearFavorites}
      />
    </div>
  );
}

function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  return (
    <button type="button" onClick={toggleTheme} className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${
      isDark
        ? "border-[rgba(0,212,255,0.12)] bg-[#12162A] text-[#8B92A8] hover:border-[#00D4FF]/30 hover:text-white"
        : "border-gray-200 bg-white text-gray-500 hover:border-[#00B4D8]/30 hover:text-gray-700"
    }`} title={isDark ? "切换浅色" : "切换深色"}>
      {isDark ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
        </svg>
      )}
    </button>
  );
}

export default function Home() {
  return (
    <ThemeProvider>
      <InnerApp />
    </ThemeProvider>
  );
}
