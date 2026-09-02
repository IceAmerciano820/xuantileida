"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { ThemeProvider, useTheme } from "@/hooks/use-theme";
import { SearchInput } from "@/components/search-input";
import { ResultCard } from "@/components/result-card";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { HeatTrendChart } from "@/components/heat-trend-chart";
import { TrendCompareChart, type KeywordTrend } from "@/components/trend-compare-chart";
import { GenerateContentModal } from "@/components/generate-content-modal";
import { FavoritesModal } from "@/components/favorites-modal";
import { RadarIcon, RadarBackground } from "@/components/radar-icon";
import { LandingView } from "@/components/landing-view";
import { RadarLandingPage } from "@/components/radar-landing-page";
import { MonitorKeywordsModal } from "@/components/monitor-keywords-modal";
import { DailyBriefing } from "@/components/daily-briefing";
import { PWARegistrar } from "@/components/pwa-registrar";

export type FavoriteStatus = "draft" | "scheduled" | "published";
export type TrendTag = "暴涨" | "平稳" | "降温" | "潜力黑马";
export type RiskLevel = "低" | "中" | "高";
export type ResultTab = "all" | "potential" | "risk";

export interface TopicAngle {
  id: string;
  title: string;
  source: string;
  url: string;
  snippet: string;
  heatScore: number;
  heatLevel: "high" | "medium" | "low";
  publishTime: string;
  trendTag: TrendTag;
  score: number;
  scoreReason: string;
  angles: string[];
  relatedWords: string[];
  riskLevel: RiskLevel;
  isPromotional?: boolean;
  matchedQueries?: string[];
  status?: FavoriteStatus;
  scheduledDate?: string;
  note?: string;
  customTags?: string[];
}

interface TrendDataPoint {
  date: string;
  score: number;
}

export interface SearchResponse {
  keyword: string;
  topics: TopicAngle[];
  totalFound?: number;
  message?: string;
  trendData?: TrendDataPoint[];
}

type TimeRange = "6h" | "1d" | "7d";
type SortBy = "latest" | "hottest";

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string; desc: string }[] = [
  { value: "6h", label: "近6小时", desc: "追突发热点" },
  { value: "1d", label: "近24小时", desc: "日常选题" },
  { value: "7d", label: "近7天", desc: "中长周期策划" },
];
const TIME_RANGE_LABELS: Record<TimeRange, string> = { "6h": "近6小时", "1d": "近24小时", "7d": "近7天" };

const PLATFORM_FILTERS = ["全部", "抖音", "小红书", "微博", "百度", "知乎"];
const SYSTEM_TRACKS = ["AI工具", "副业", "搞钱", "减肥", "护肤", "职场", "育儿", "考研", "买房", "理财"];
const HOT_KEYWORDS = SYSTEM_TRACKS;

const HISTORY_KEY = "hotspot_search_history";
const FAVORITES_KEY = "hotspot_favorites_v2";
const CUSTOM_TRACKS_KEY = "hotspot_custom_tracks";
const IGNORED_TOPICS_KEY = "hotspot_ignored_topics";
const DONE_TOPICS_KEY = "hotspot_done_topics";
const MAX_HISTORY = 10;
const REQUEST_COUNT = 30;
const CACHE_TTL = 5 * 60 * 1000;
const APP_VERSION = "v2.4.0";
const FIRST_SCREEN_TIMEOUT_MS = 30000;
const FULL_TIMEOUT_MS = 60000;
const SEARCH_DEBOUNCE_MS = 300;

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

function favKey(topic: TopicAngle): string {
  return topic.url || topic.id;
}

function InnerApp() {
  const { isDark } = useTheme();

  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState("");
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
  const [displayCount, setDisplayCount] = useState(20);
  const [showHotOnly, setShowHotOnly] = useState(false);
  // v2.1: New states
  const [resultTab, setResultTab] = useState<ResultTab>("all");
  const [customTracks, setCustomTracks] = useState<string[]>([]);
  const [ignoredTopics, setIgnoredTopics] = useState<Set<string>>(new Set());
  const [doneTopics, setDoneTopics] = useState<Set<string>>(new Set());
  const [trackFilter, setTrackFilter] = useState<string>("全部");
  const [newTrackInput, setNewTrackInput] = useState("");
  const [showNewTrackInput, setShowNewTrackInput] = useState(false);
  // P2-3: Trend compare state
  const [compareKeywords, setCompareKeywords] = useState<string[]>([]);
  const [compareData, setCompareData] = useState<{ trends: KeywordTrend[]; conclusion: string; xLabels: string[] } | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareInput, setCompareInput] = useState("");
  const [showCompareInput, setShowCompareInput] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const cacheRef = useRef<{ key: string; data: SearchResponse; timestamp: number } | null>(null);
  const hasInitialized = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // v2.2: SSE progress state
  const [sseProgress, setSseProgress] = useState<{ completed: number; total: number } | null>(null);
  // v2.4: Monitor keywords & daily briefing
  const [monitoredKeywords, setMonitoredKeywords] = useState<string[]>([]);
  const [showMonitorModal, setShowMonitorModal] = useState(false);
  const [showBriefing] = useState(true);
  // v2.2: Landing page state
  const [showLanding, setShowLanding] = useState(false);

  // Check sessionStorage for landing page on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const seen = sessionStorage.getItem("landing_seen");
      if (!seen) {
        setShowLanding(true);
      }
    }
  }, []);

  const handleLandingEnter = useCallback(() => {
    sessionStorage.setItem("landing_seen", "1");
    setShowLanding(false);
  }, []);

  // v2.4: Save monitored keywords
  const handleSaveMonitorKeywords = useCallback((keywords: string[]) => {
    setMonitoredKeywords(keywords);
    saveToStorage("hotspot_monitored_keywords", keywords);
  }, []);

  // Load from localStorage with P0-2 migration (dedup by URL)
  useEffect(() => {
    setHistory(loadFromStorage<string[]>(HISTORY_KEY, []));
    const loadedFavs = loadFromStorage<TopicAngle[]>(FAVORITES_KEY, []);
    const seen = new Set<string>();
    const deduped = loadedFavs.filter(f => {
      const key = favKey(f);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setFavorites(deduped);
    if (deduped.length !== loadedFavs.length) saveToStorage(FAVORITES_KEY, deduped);
    setCustomTracks(loadFromStorage<string[]>(CUSTOM_TRACKS_KEY, []));
    const ignored = loadFromStorage<string[]>(IGNORED_TOPICS_KEY, []);
    setIgnoredTopics(new Set(ignored));
    const done = loadFromStorage<string[]>(DONE_TOPICS_KEY, []);
    setDoneTopics(new Set(done));
    // v2.4: Load monitored keywords
    const mk = loadFromStorage<string[]>("hotspot_monitored_keywords", []);
    setMonitoredKeywords(mk);
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

  const updateUrl = useCallback((kw: string, range: TimeRange) => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (kw) params.set("keyword", kw);
    if (range !== "1d") params.set("range", range);
    const qs = params.toString();
    window.history.replaceState({}, "", qs ? `?${qs}` : window.location.pathname);
  }, []);

  // v2.1: Core search with loading phases + timeout
  const doSearch = useCallback(async (kw: string, range: TimeRange, count: number) => {
    const trimmed = kw.trim();
    if (!trimmed) { setInputError("请输入话题关键词再采集"); return; }
    setInputError(null);
    setNetworkError(null);

    // P2-8: Check cache (5 min)
    const cacheKey = `${trimmed}:${range}:${count}`;
    const now = Date.now();
    if (cacheRef.current && cacheRef.current.key === cacheKey && now - cacheRef.current.timestamp < CACHE_TTL) {
      setResults(cacheRef.current.data);
      setSearchedKeyword(trimmed);
      setDisplayCount(20);
      setPlatformFilter("全部");
      setShowHotOnly(false);
      setResultTab("all");
      setSseProgress(null);
      return;
    }

    // Abort previous request if any
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const abortController = new AbortController();
    abortRef.current = abortController;

    setLoading(true);
    setResults(null);
    setSearchedKeyword(trimmed);
    setDisplayCount(20);
    setPlatformFilter("全部");
    setShowHotOnly(false);
    setShowMobileMenu(false);
    setResultTab("all");
    setSseProgress(null);

    // Loading phases
    setLoadingPhase("正在扫描全网热点...");

    // Timeout handling: 30s for first screen, 60s total
    let firstScreenReceived = false;
    let timedOut = false;
    timeoutRef.current = setTimeout(() => {
      if (!firstScreenReceived) {
        timedOut = true;
        abortController.abort();
        setLoading(false);
        setLoadingPhase("");
        setSseProgress(null);
        setNetworkError("扫描超时，请缩小时间范围或更换关键词重试");
      }
    }, FIRST_SCREEN_TIMEOUT_MS);

    const fullTimeout = setTimeout(() => {
      if (!timedOut) {
        timedOut = true;
        abortController.abort();
        setLoading(false);
        setLoadingPhase("");
        setSseProgress(null);
        setNetworkError("全量分析超时，已展示已完成的分析结果");
      }
    }, FULL_TIMEOUT_MS);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: trimmed, timeRange: range, count, stream: true }),
        signal: abortController.signal,
      });

      if (timedOut) return;
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }

      if (!response.ok) {
        clearTimeout(fullTimeout);
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `请求失败 (${response.status})`);
      }

      // SSE streaming consumption
      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedTopics: TopicAngle[] = [];
      let trendData: TrendDataPoint[] = [];
      let totalFound = 0;
      let message = "";

      setLoadingPhase("AI 解析选题角度...");

      while (true) {
        const { done, value } = await reader.read();
        if (done || timedOut) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "meta") {
              totalFound = data.total;
              trendData = data.trendData || [];
              message = data.message || "";
              if (data.total === 0) {
                // No results
                setResults({ keyword: trimmed, topics: [], totalFound: 0, message, trendData });
                setLoading(false);
                setLoadingPhase("");
                clearTimeout(fullTimeout);
                return;
              }
            } else if (data.type === "batch") {
              if (!firstScreenReceived) {
                firstScreenReceived = true;
                // Switch to full timeout for remaining
                if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
              }
              const batchTopics = data.topics as TopicAngle[];
              accumulatedTopics = [...accumulatedTopics, ...batchTopics];
              setSseProgress({ completed: data.completed || accumulatedTopics.length, total: data.total || totalFound });
              setLoadingPhase(`AI 分析选题角度（已完成 ${data.completed || accumulatedTopics.length}/${data.total || totalFound}）`);

              // Progressive render: update results with what we have so far
              const partialResults: SearchResponse = {
                keyword: trimmed,
                topics: accumulatedTopics,
                totalFound,
                trendData,
                message,
              };
              setResults(partialResults);
            } else if (data.type === "done") {
              // Final results
              const finalResults: SearchResponse = {
                keyword: trimmed,
                topics: accumulatedTopics,
                totalFound,
                trendData,
                message,
              };
              setResults(finalResults);
              cacheRef.current = { key: cacheKey, data: finalResults, timestamp: Date.now() };
              if (accumulatedTopics.length > 0) addToHistory(trimmed);
              updateUrl(trimmed, range);
            } else if (data.type === "error") {
              throw new Error(data.message || "分析过程出错");
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== "分析过程出错") {
              // JSON parse error, skip this line
              continue;
            }
            throw parseErr;
          }
        }
      }

      // If we got here without a "done" event but have some results, still cache them
      if (accumulatedTopics.length > 0 && !cacheRef.current) {
        const partialResults: SearchResponse = {
          keyword: trimmed,
          topics: accumulatedTopics,
          totalFound,
          trendData,
          message,
        };
        setResults(partialResults);
        cacheRef.current = { key: cacheKey, data: partialResults, timestamp: Date.now() };
        if (accumulatedTopics.length > 0) addToHistory(trimmed);
        updateUrl(trimmed, range);
      }
    } catch (err: unknown) {
      if (timedOut) return;
      if (err instanceof Error && err.name === "AbortError") return;
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      clearTimeout(fullTimeout);
      const message = err instanceof Error ? err.message : "";
      if (message.includes("Failed to fetch") || message.includes("NetworkError") || !message) {
        setNetworkError("网络异常，请稍后重试");
      } else {
        setNetworkError(message || "搜索服务暂时不可用，请稍后重试");
      }
    } finally {
      if (!timedOut) {
        clearTimeout(fullTimeout);
        setLoading(false);
        setLoadingPhase("");
        setSseProgress(null);
      }
    }
  }, [addToHistory, updateUrl]);

  // P2-7: Read URL params on mount + P1-1: auto-load default content
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const kw = params.get("keyword");
    const range = params.get("range") as TimeRange | null;
    const platform = params.get("platform");

    if (range && ["6h", "1d", "7d"].includes(range)) setTimeRange(range);
    if (platform && PLATFORM_FILTERS.includes(platform)) setPlatformFilter(platform);

    if (kw) {
      setKeyword(kw);
      doSearch(kw, range || "1d", REQUEST_COUNT);
    } else {
      // P1-1: Auto-load default content
      doSearch("今日热点", "1d", REQUEST_COUNT);
    }
  }, [doSearch]);

  const handleSearch = useCallback((kw: string) => {
    // v2.2: Debounce 300ms
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(kw, timeRange, REQUEST_COUNT);
    }, SEARCH_DEBOUNCE_MS);
  }, [doSearch, timeRange]);

  // P0-1: Re-search when time range changes
  const handleTimeRangeChange = useCallback((newRange: TimeRange) => {
    setTimeRange(newRange);
    if (searchedKeyword) {
      doSearch(searchedKeyword, newRange, REQUEST_COUNT);
    }
  }, [searchedKeyword, doSearch]);

  // P2-3: Trend comparison
  const fetchCompareData = useCallback(async (allKeywords: string[], range: TimeRange) => {
    if (allKeywords.length < 2) {
      setCompareData(null);
      return;
    }
    setCompareLoading(true);
    try {
      const response = await fetch("/api/trend-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: allKeywords, timeRange: range }),
      });
      if (!response.ok) {
        throw new Error("对比数据获取失败");
      }
      const data = await response.json();
      setCompareData(data);
    } catch {
      setCompareData(null);
    } finally {
      setCompareLoading(false);
    }
  }, []);

  const handleAddCompareKeyword = useCallback((kw: string) => {
    const trimmed = kw.trim();
    if (!trimmed || trimmed === searchedKeyword || compareKeywords.includes(trimmed)) return;
    if (compareKeywords.length >= 2) return; // Max 3 total (1 main + 2 compare)
    const next = [...compareKeywords, trimmed];
    setCompareKeywords(next);
    setCompareInput("");
    setShowCompareInput(false);
    fetchCompareData([searchedKeyword, ...next], timeRange);
  }, [compareKeywords, searchedKeyword, timeRange, fetchCompareData]);

  const handleRemoveCompareKeyword = useCallback((kw: string) => {
    const next = compareKeywords.filter(k => k !== kw);
    setCompareKeywords(next);
    if (searchedKeyword && next.length >= 1) {
      fetchCompareData([searchedKeyword, ...next], timeRange);
    } else {
      setCompareData(null);
    }
  }, [compareKeywords, searchedKeyword, timeRange, fetchCompareData]);

  // Reset comparison when a new search is performed
  useEffect(() => {
    if (compareKeywords.length > 0 || compareData) {
      setCompareKeywords([]);
      setCompareData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchedKeyword]);

  // Re-fetch comparison data when time range changes
  useEffect(() => {
    if (compareKeywords.length > 0 && searchedKeyword) {
      fetchCompareData([searchedKeyword, ...compareKeywords], timeRange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  const handleSubmit = useCallback(() => { handleSearch(keyword); }, [handleSearch, keyword]);
  const handleKeywordClick = useCallback((kw: string) => { setKeyword(kw); setInputError(null); handleSearch(kw); }, [handleSearch]);

  // P1-2: Load more
  const handleLoadMore = useCallback(() => {
    setDisplayCount(prev => prev + 20);
  }, []);

  // P0-2: Favorites by URL
  const handleToggleFavorite = useCallback((topic: TopicAngle) => {
    const key = favKey(topic);
    setFavorites(prev => {
      const exists = prev.some(f => favKey(f) === key);
      const next = exists ? prev.filter(f => favKey(f) !== key) : [topic, ...prev];
      const seen = new Set<string>();
      const deduped = next.filter(f => {
        const k = favKey(f);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      saveToStorage(FAVORITES_KEY, deduped);
      return deduped;
    });
  }, []);

  const handleRemoveFavorite = useCallback((key: string) => {
    setFavorites(prev => {
      const next = prev.filter(f => favKey(f) !== key);
      saveToStorage(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  const handleClearFavorites = useCallback(() => {
    setFavorites([]);
    saveToStorage(FAVORITES_KEY, []);
  }, []);

  // P2-6: Update favorite status (draft/scheduled/published)
  const handleUpdateFavoriteStatus = useCallback((key: string, status: FavoriteStatus) => {
    setFavorites(prev => {
      const next = prev.map(f => favKey(f) === key ? { ...f, status } : f);
      saveToStorage(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  // P2-6: Schedule a favorite to a specific date
  const handleScheduleFavorite = useCallback((key: string, date: string | undefined) => {
    setFavorites(prev => {
      const next = prev.map(f => favKey(f) === key
        ? { ...f, scheduledDate: date, status: date ? "scheduled" as FavoriteStatus : (f.status === "scheduled" ? "draft" as FavoriteStatus : f.status) }
        : f
      );
      saveToStorage(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  // v2.1: Update note on a favorite
  const handleUpdateNote = useCallback((key: string, note: string) => {
    setFavorites(prev => {
      const next = prev.map(f => favKey(f) === key ? { ...f, note } : f);
      saveToStorage(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  // v2.1: Update custom tags on a favorite
  const handleUpdateTags = useCallback((key: string, tags: string[]) => {
    setFavorites(prev => {
      const next = prev.map(f => favKey(f) === key ? { ...f, customTags: tags } : f);
      saveToStorage(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  // v2.1: Import favorites from JSON
  const handleImportFavorites = useCallback((items: TopicAngle[]) => {
    setFavorites(prev => {
      const existingUrls = new Set(prev.map(f => f.url).filter(Boolean));
      const newItems = items.filter(item => !existingUrls.has(item.url));
      const next = [...prev, ...newItems];
      saveToStorage(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  // v2.1: Ignore a topic (remove from current list)
  const handleIgnoreTopic = useCallback((topicKey: string) => {
    setIgnoredTopics(prev => {
      const next = new Set(prev);
      next.add(topicKey);
      saveToStorage(IGNORED_TOPICS_KEY, Array.from(next));
      return next;
    });
  }, []);

  // v2.1: Mark topic as done (greyed out in results)
  const handleMarkDone = useCallback((topicKey: string) => {
    setDoneTopics(prev => {
      const next = new Set(prev);
      if (next.has(topicKey)) { next.delete(topicKey); } else { next.add(topicKey); }
      saveToStorage(DONE_TOPICS_KEY, Array.from(next));
      return next;
    });
  }, []);

  // v2.1: Custom tracks management
  const handleAddCustomTrack = useCallback((track: string) => {
    const trimmed = track.trim();
    if (!trimmed) return;
    if (SYSTEM_TRACKS.includes(trimmed) || customTracks.includes(trimmed)) return;
    const next = [...customTracks, trimmed];
    setCustomTracks(next);
    saveToStorage(CUSTOM_TRACKS_KEY, next);
    setNewTrackInput("");
    setShowNewTrackInput(false);
  }, [customTracks]);

  const handleRemoveCustomTrack = useCallback((track: string) => {
    const next = customTracks.filter(t => t !== track);
    setCustomTracks(next);
    saveToStorage(CUSTOM_TRACKS_KEY, next);
    if (trackFilter === track) setTrackFilter("全部");
  }, [customTracks, trackFilter]);

  // v2.1: Filtered, sorted, sliced results with tab/track/ignored filtering
  const displayedTopics = useMemo(() => {
    if (!results) return [];
    let filtered = results.topics.filter(t => !ignoredTopics.has(t.url || t.id));
    if (platformFilter !== "全部") {
      filtered = filtered.filter(t => t.source.includes(platformFilter));
    }
    if (showHotOnly) {
      filtered = filtered.filter(t => t.heatScore >= 70);
    }
    // v2.1: Tab filter
    if (resultTab === "potential") {
      filtered = filtered.filter(t => t.trendTag === "潜力黑马");
    } else if (resultTab === "risk") {
      filtered = filtered.filter(t => t.riskLevel === "中" || t.riskLevel === "高");
    }
    // v2.1: Track filter
    if (trackFilter !== "全部") {
      const lower = trackFilter.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(lower) ||
        t.snippet.toLowerCase().includes(lower) ||
        t.relatedWords.some(w => w.toLowerCase().includes(lower))
      );
    }
    const sorted = [...filtered];
    if (sortBy === "latest") {
      sorted.sort((a, b) => new Date(b.publishTime).getTime() - new Date(a.publishTime).getTime());
    } else {
      sorted.sort((a, b) => b.heatScore - a.heatScore);
    }
    return sorted;
  }, [results, platformFilter, sortBy, showHotOnly, resultTab, trackFilter, ignoredTopics]);

  const visibleTopics = displayedTopics.slice(0, displayCount);
  const hasMore = displayedTopics.length > displayCount;

  // v2.1: Tab counts
  const potentialCount = useMemo(() => {
    if (!results) return 0;
    return results.topics.filter(t => !ignoredTopics.has(t.url || t.id) && t.trendTag === "潜力黑马").length;
  }, [results, ignoredTopics]);

  const riskCount = useMemo(() => {
    if (!results) return 0;
    return results.topics.filter(t => !ignoredTopics.has(t.url || t.id) && (t.riskLevel === "中" || t.riskLevel === "高")).length;
  }, [results, ignoredTopics]);

  const isFavorited = useCallback(
    (topic: TopicAngle) => favorites.some(f => favKey(f) === favKey(topic)),
    [favorites]
  );

  // Export functions
  const buildExportText = useCallback(() => {
    if (!results || displayedTopics.length === 0) return "";
    const lines: string[] = [
      `选题雷达 - 「${searchedKeyword}」`,
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
      `# 选题雷达 - 「${searchedKeyword}」`,
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
    a.download = `选题雷达_${searchedKeyword}_${new Date().toISOString().slice(0, 10)}.md`;
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
    a.download = `选题雷达_${searchedKeyword}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [buildExportText, searchedKeyword]);

  const hasResults = results && results.topics.length > 0;
  const hasNoResults = results && results.topics.length === 0;

  return (
    <>
      {showLanding && <RadarLandingPage onEnter={handleLandingEnter} />}
      <div className={`relative flex min-h-screen flex-col transition-colors duration-300 ${isDark ? "bg-[#0A0E1A]" : "bg-[#FAFAFA]"}`}>
        <RadarBackground isDark={isDark} />

      {/* Header */}
      <header className={`sticky top-0 z-40 no-print ${
        isDark ? "header-glass-dark" : "header-glass-light"
      }`}>
        <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isDark ? "bg-[#00D4FF]/10" : "bg-[#00B4D8]/10"}`}>
              <RadarIcon size={20} className={isDark ? "text-[#00D4FF]" : "text-[#00B4D8]"} />
            </div>
            <h1 className={`text-lg font-bold tracking-tight ${isDark ? "bg-gradient-to-r from-[#00D4FF] to-[#0066FF] bg-clip-text text-transparent" : "text-gray-900"}`}>
              选题雷达
            </h1>
          </div>

          {/* Desktop toolbar */}
          <div className="hidden items-center gap-2 sm:flex">
            {/* P0-1: Time range with re-search */}
            <div className="relative">
              <select
                value={timeRange}
                onChange={(e) => handleTimeRangeChange(e.target.value as TimeRange)}
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
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
              灵感库{favorites.length > 0 && <span className="text-[#00D4FF]">({favorites.length})</span>}
            </button>

            {/* v2.4: Monitor keywords button */}
            <button type="button" onClick={() => setShowMonitorModal(true)} className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-all ${
              isDark ? "border-[rgba(0,212,255,0.12)] bg-[#12162A] text-[#8B92A8] hover:border-[#00D4FF]/30 hover:text-white" : "border-gray-200 bg-white text-gray-600 hover:border-[#00B4D8]/30 hover:text-gray-900"
            }`}>
              <span className="text-sm leading-none">📡</span>
              我的监控
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
                        <button key={opt.value} type="button" onClick={() => { handleTimeRangeChange(opt.value); setShowMobileMenu(false); }} disabled={loading} className={`rounded-md px-2.5 py-1 text-xs transition-all disabled:opacity-50 ${
                          timeRange === opt.value
                            ? (isDark ? "bg-[#00D4FF]/15 font-medium text-[#00D4FF]" : "bg-[#00B4D8]/15 font-medium text-[#00B4D8]")
                            : (isDark ? "text-[#8B92A8] hover:bg-[#252B3D]" : "text-gray-600 hover:bg-gray-100")
                        }`}>{opt.label}</button>
                      ))}
                    </div>
                  </div>
                  <button type="button" onClick={() => { setShowFavorites(true); setShowMobileMenu(false); }} className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs transition-colors ${isDark ? "text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "text-gray-600 hover:bg-gray-50"}`}>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
                    灵感库 ({favorites.length})
                  </button>
                  {hasResults && (
                    <>
                      <button type="button" onClick={() => { handleCopyAll(); setShowMobileMenu(false); }} className={`flex w-full items-center gap-2 border-t px-3 py-2.5 text-left text-xs ${isDark ? "border-[rgba(0,212,255,0.06)] text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "border-gray-100 text-gray-600 hover:bg-gray-50"}`}>复制全部</button>
                      <button type="button" onClick={() => { handleExportMarkdown(); setShowMobileMenu(false); }} className={`flex w-full items-center gap-2 border-t px-3 py-2.5 text-left text-xs ${isDark ? "border-[rgba(0,212,255,0.06)] text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "border-gray-100 text-gray-600 hover:bg-gray-50"}`}>导出 Markdown</button>
                      <button type="button" onClick={() => { handleExportPDF(); setShowMobileMenu(false); }} className={`flex w-full items-center gap-2 border-t px-3 py-2.5 text-left text-xs ${isDark ? "border-[rgba(0,212,255,0.06)] text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "border-gray-100 text-gray-600 hover:bg-gray-50"}`}>导出 PDF</button>
                      <button type="button" onClick={() => { handleDownloadTxt(); setShowMobileMenu(false); }} className={`flex w-full items-center gap-2 border-t px-3 py-2.5 text-left text-xs ${isDark ? "border-[rgba(0,212,255,0.06)] text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "border-gray-100 text-gray-600 hover:bg-gray-50"}`}>下载 TXT</button>
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

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-5 sm:px-6 sm:py-8">
        {/* Search Section */}
        <section className={`mb-5 rounded-[14px] p-4 backdrop-blur-xl sm:p-5 no-print ${
          isDark ? "glass-card-dark" : "glass-card-light"
        }`}>
          <SearchInput value={keyword} onChange={setKeyword} onSubmit={handleSubmit} loading={loading} error={inputError} />

          {/* History + Recommendations */}
          <div className="mt-3 space-y-2">
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

        {/* Loading - show skeleton only before first results arrive */}
        {loading && (!results || results.topics.length === 0) && (
          <LoadingSkeleton phase={loadingPhase} progress={sseProgress ?? undefined} />
        )}

        {/* Error */}
        {networkError && !loading && <EmptyState variant="error" message={networkError} onRetry={handleSubmit} />}

        {/* No Results */}
        {hasNoResults && !loading && <EmptyState variant="no-results" message={results.message} onKeywordClick={handleKeywordClick} />}

        {/* Initial - Landing View with hot topics + track exploration */}
        {!loading && !results && !networkError && (
          <div className="space-y-6">
            {/* v2.4: Daily Briefing */}
            {showBriefing && (
              <DailyBriefing
                monitoredKeywords={monitoredKeywords}
                onSearch={(kw) => { setKeyword(kw); doSearch(kw, timeRange, REQUEST_COUNT); }}
                onOpenMonitor={() => setShowMonitorModal(true)}
              />
            )}
            <LandingView onSearch={(kw) => { setKeyword(kw); doSearch(kw, timeRange, REQUEST_COUNT); }} />
          </div>
        )}

        {/* Results */}
        {hasResults && (
          <section>
            {/* Results header */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setResults(null); setSearchedKeyword(""); setKeyword(""); setDisplayCount(20); setResultTab("all"); setPlatformFilter("全部"); setTrackFilter("全部"); }}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-all ${
                    isDark
                      ? "text-[#64748B] hover:bg-[rgba(22,27,45,0.8)] hover:text-[#94A3B8]"
                      : "text-[#94A3B8] hover:bg-gray-100 hover:text-[#475569]"
                  }`}
                  title="返回首页"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                  </svg>
                  首页
                </button>
                <p className={`text-sm ${isDark ? "text-[#94A3B8]" : "text-[#475569]"}`}>
                  找到 <span className={`font-medium ${isDark ? "text-[#F1F5F9]" : "text-[#0F172A]"}`}>{displayedTopics.length}</span> 条相关热点
                  <span className={`ml-1.5 text-xs ${isDark ? "text-[#64748B]" : "text-[#94A3B8]"}`}>{TIME_RANGE_LABELS[timeRange]}</span>
                </p>
              </div>
            </div>

            {/* v2.1: Tab bar (全部 | 潜力热点 | 风险提示) */}
            <div className={`mb-3 flex items-center gap-1 overflow-x-auto scrollbar-none rounded-xl border p-1.5 no-print ${
              isDark ? "border-[rgba(0,212,255,0.08)] bg-[#12162A]/30" : "border-gray-100 bg-white shadow-sm"
            }`}>
              {([
                { key: "all" as ResultTab, label: "全部", count: displayedTopics.length },
                { key: "potential" as ResultTab, label: "📈 潜力热点", count: potentialCount },
                { key: "risk" as ResultTab, label: "⚠️ 风险提示", count: riskCount },
              ]).map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => { setResultTab(tab.key); setDisplayCount(20); }}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    resultTab === tab.key
                      ? (isDark ? "bg-[#00D4FF]/15 text-[#00D4FF]" : "bg-[#00B4D8]/10 text-[#00B4D8]")
                      : (isDark ? "text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700")
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && <span className="ml-1 text-[10px] opacity-60">({tab.count})</span>}
                </button>
              ))}
            </div>

            {/* v2.1: Track filter bar */}
            <div className={`mb-4 flex flex-wrap items-center gap-1.5 no-print`}>
              <button
                type="button"
                onClick={() => setTrackFilter("全部")}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                  trackFilter === "全部"
                    ? (isDark ? "bg-[#252B3D] text-white" : "bg-gray-200 text-gray-800")
                    : (isDark ? "text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700")
                }`}
              >全部赛道</button>
              {SYSTEM_TRACKS.map(track => (
                <button
                  key={track}
                  type="button"
                  onClick={() => setTrackFilter(track === trackFilter ? "全部" : track)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-all ${
                    trackFilter === track
                      ? (isDark ? "border-[#00D4FF]/40 bg-[#00D4FF]/10 text-[#00D4FF]" : "border-[#00B4D8]/40 bg-blue-50 text-[#00B4D8]")
                      : (isDark ? "border-[rgba(0,212,255,0.1)] text-[#8B92A8] hover:border-[#00D4FF]/30 hover:text-white" : "border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700")
                  }`}
                >{track}</button>
              ))}
              {/* Custom tracks */}
              {customTracks.map(track => (
                <span key={track} className="group/track relative inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => setTrackFilter(track === trackFilter ? "全部" : track)}
                    className={`rounded-full border border-dashed px-2.5 py-1 text-xs transition-all ${
                      trackFilter === track
                        ? (isDark ? "border-[#A855F7]/40 bg-[#A855F7]/10 text-[#A855F7]" : "border-purple-300 bg-purple-50 text-purple-600")
                        : (isDark ? "border-[rgba(168,85,247,0.2)] text-[#8B92A8] hover:border-[#A855F7]/30 hover:text-white" : "border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700")
                    }`}
                  >{track}</button>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomTrack(track)}
                    className={`ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] transition-all ${
                      isDark ? "text-[#8B92A8]/40 hover:text-[#FF4D6A]" : "text-gray-300 hover:text-red-400"
                    }`}
                    title="删除此赛道"
                  >×</button>
                </span>
              ))}
              {/* Add custom track */}
              {showNewTrackInput ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newTrackInput}
                    onChange={(e) => setNewTrackInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && newTrackInput.trim()) handleAddCustomTrack(newTrackInput); if (e.key === "Escape") { setShowNewTrackInput(false); setNewTrackInput(""); } }}
                    placeholder="输入赛道名"
                    autoFocus
                    className={`h-7 w-24 rounded-lg border px-2 text-xs outline-none ${
                      isDark ? "border-[rgba(0,212,255,0.15)] bg-[#12162A] text-white placeholder:text-[#8B92A8]/40" : "border-gray-200 bg-white text-gray-900 placeholder:text-gray-400"
                    }`}
                  />
                  <button type="button" onClick={() => newTrackInput.trim() && handleAddCustomTrack(newTrackInput)} className="text-xs text-[#00D4FF]">确定</button>
                  <button type="button" onClick={() => { setShowNewTrackInput(false); setNewTrackInput(""); }} className={`text-xs ${isDark ? "text-[#8B92A8]" : "text-gray-400"}`}>取消</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNewTrackInput(true)}
                  className={`rounded-full border border-dashed px-2 py-1 text-xs transition-all ${
                    isDark ? "border-[rgba(0,212,255,0.15)] text-[#8B92A8]/50 hover:border-[#00D4FF]/30 hover:text-[#00D4FF]" : "border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600"
                  }`}
                >+ 我的赛道</button>
              )}
            </div>

            {/* Platform filter + Sort + P2-1: Hot only toggle */}
            <div className={`mb-4 flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between no-print ${
              isDark ? "border-[rgba(0,212,255,0.08)] bg-[#12162A]/30" : "border-gray-100 bg-white shadow-sm"
            }`}>
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                {PLATFORM_FILTERS.map((p) => (
                  <button key={p} type="button" onClick={() => setPlatformFilter(p)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    platformFilter === p
                      ? (isDark ? "bg-[#00D4FF] text-[#0A0E1A]" : "bg-[#00B4D8] text-white")
                      : (isDark ? "text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700")
                  }`}>{p}</button>
                ))}
                {/* P2-1: Only hot filter */}
                <button type="button" onClick={() => setShowHotOnly(!showHotOnly)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  showHotOnly
                    ? "bg-[#FF6B35]/15 text-[#FF6B35] ring-1 ring-[#FF6B35]/30"
                    : isDark
                      ? "text-[#8B92A8] hover:bg-[#252B3D] hover:text-white"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                }`}>
                  {showHotOnly ? "🔥 " : ""}只看爆款
                </button>
              </div>
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

            {/* P2-2: Heat Trend Chart with time range */}
            {results.trendData && results.trendData.length > 0 && (
              <div className="mb-5 no-print">
                <HeatTrendChart keyword={searchedKeyword} data={results.trendData} timeRange={timeRange} />
              </div>
            )}

            {/* P2-3: Multi-keyword trend comparison */}
            <div className="mb-5 no-print">
              {/* Add compare keyword entry */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCompareInput(!showCompareInput)}
                  disabled={compareKeywords.length >= 2}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-40 ${
                    isDark
                      ? "border-[rgba(0,212,255,0.15)] text-[#00D4FF]/80 hover:border-[#00D4FF]/30 hover:text-[#00D4FF]"
                      : "border-[#00B4D8]/20 text-[#00B4D8]/80 hover:border-[#00B4D8]/40 hover:text-[#00B4D8]"
                  }`}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                  </svg>
                  {compareKeywords.length === 0 ? "添加对比关键词" : "再添加一个"}
                  <span className={`ml-0.5 text-[10px] ${isDark ? "text-[#8B92A8]/50" : "text-gray-400"}`}>({compareKeywords.length + 1}/3)</span>
                </button>
              </div>

              {/* Compare keyword input */}
              {showCompareInput && (
                <div className={`mt-2 flex items-center gap-2 rounded-xl border p-2.5 ${
                  isDark ? "border-[rgba(0,212,255,0.08)] bg-[#12162A]/50" : "border-gray-100 bg-gray-50"
                }`}>
                  <input
                    type="text"
                    value={compareInput}
                    onChange={(e) => setCompareInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && compareInput.trim()) handleAddCompareKeyword(compareInput); }}
                    placeholder="输入对比关键词，按回车添加"
                    autoFocus
                    className={`flex-1 bg-transparent text-sm outline-none ${isDark ? "text-white placeholder:text-[#8B92A8]/50" : "text-gray-900 placeholder:text-gray-400"}`}
                  />
                  <button
                    type="button"
                    onClick={() => compareInput.trim() && handleAddCompareKeyword(compareInput)}
                    disabled={!compareInput.trim()}
                    className="rounded-lg bg-[#00D4FF] px-3 py-1 text-xs font-medium text-[#0A0E1A] transition-all hover:opacity-80 disabled:opacity-40"
                  >
                    添加
                  </button>
                  <button type="button" onClick={() => { setShowCompareInput(false); setCompareInput(""); }} className={`text-xs ${isDark ? "text-[#8B92A8] hover:text-white" : "text-gray-400 hover:text-gray-600"}`}>
                    取消
                  </button>
                  {/* Quick pick from history */}
                  {history.length > 0 && (
                    <div className="flex items-center gap-1">
                      {history.filter(h => h !== searchedKeyword && !compareKeywords.includes(h)).slice(0, 3).map(h => (
                        <button key={h} type="button" onClick={() => handleAddCompareKeyword(h)} className={`rounded-full border px-2 py-0.5 text-[11px] transition-all ${
                          isDark ? "border-[rgba(0,212,255,0.12)] text-[#8B92A8] hover:text-[#00D4FF]" : "border-gray-200 text-gray-500 hover:text-[#00B4D8]"
                        }`}>{h}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Compare chart */}
              {(compareLoading || (compareData && compareKeywords.length > 0)) && (
                <div className="mt-3">
                  <TrendCompareChart
                    trends={compareData?.trends || []}
                    conclusion={compareData?.conclusion || ""}
                    xLabels={compareData?.xLabels || []}
                    timeRange={timeRange}
                    loading={compareLoading}
                    onRemoveKeyword={handleRemoveCompareKeyword}
                  />
                </div>
              )}
            </div>

            {/* Cards */}
            <div className="space-y-4">
              {visibleTopics.map((topic, index) => (
                <ResultCard
                  key={favKey(topic)}
                  topic={topic}
                  index={index}
                  isFavorited={isFavorited(topic)}
                  isDone={doneTopics.has(topic.url || topic.id)}
                  onToggleFavorite={handleToggleFavorite}
                  onGenerate={setGenerateTarget}
                  onIgnore={handleIgnoreTopic}
                  onMarkDone={handleMarkDone}
                />
              ))}
            </div>

            {/* P1-2: Load more */}
            {hasMore && !loading && (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  className={`inline-flex items-center gap-2 rounded-xl border px-6 py-2.5 text-sm font-medium transition-all hover:scale-[1.02] ${
                    isDark
                      ? "border-[#00D4FF]/30 text-[#00D4FF] hover:border-[#00D4FF]/50 hover:bg-[#00D4FF]/5"
                      : "border-[#00B4D8]/30 text-[#00B4D8] hover:border-[#00B4D8]/50 hover:bg-blue-50"
                  }`}
                >
                  加载更多
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              </div>
            )}

            {/* v2.2: Streaming indicator - shows while SSE is still delivering results */}
            {loading && results && results.topics.length > 0 && (
              <div className="mt-5 flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <div className="relative h-1.5 w-20 overflow-hidden rounded-full bg-[#252B3D]/50">
                    <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-[#FF6B35] to-[#00D4FF]" style={{ animation: "progress 1.5s ease-in-out infinite" }} />
                  </div>
                  <span className={`text-xs ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>
                    {loadingPhase || "正在分析更多选题..."}
                  </span>
                </div>
              </div>
            )}

            {/* P1-6: Platform filter empty state */}
            {visibleTopics.length === 0 && platformFilter !== "全部" && (
              <div className={`py-12 text-center ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>
                <p className="text-sm">该平台暂无相关热点</p>
                <p className="mt-1 text-xs">试试切换其他平台或查看全部</p>
                <button type="button" onClick={() => setPlatformFilter("全部")} className="mt-3 text-xs text-[#00D4FF] hover:underline">查看全部</button>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 no-print">
        <div className="flex flex-col items-center gap-1">
          <p className={`text-center text-[11px] ${isDark ? "text-[#475569]" : "text-[#94A3B8]"}`}>
            选题雷达 {APP_VERSION} · 数据存于本地浏览器，请定期导出备份
          </p>
        </div>
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
        onUpdateStatus={handleUpdateFavoriteStatus}
        onSchedule={handleScheduleFavorite}
        onUpdateNote={handleUpdateNote}
        onUpdateTags={handleUpdateTags}
        onImport={handleImportFavorites}
      />
      <MonitorKeywordsModal
        open={showMonitorModal}
        onClose={() => setShowMonitorModal(false)}
        keywords={monitoredKeywords}
        onSave={handleSaveMonitorKeywords}
      />
      <PWARegistrar />
    </div>
    </>
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
