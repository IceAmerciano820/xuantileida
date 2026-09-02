"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "@/hooks/use-theme";
import type { TopicAngle } from "@/app/page";

interface BriefingItem {
  keyword: string;
  topics: TopicAngle[];
  scannedAt: string;
  error?: string;
}

interface DailyBriefingData {
  date: string;
  items: BriefingItem[];
  generatedAt: string;
}

interface DailyBriefingProps {
  monitoredKeywords: string[];
  onSearch: (keyword: string) => void;
  onOpenMonitor: () => void;
}

const BRIEFING_KEY = "hotspot_daily_briefings";
const LAST_REPORT_KEY = "hotspot_last_daily_report_date";
const MAX_STORED_DAYS = 7;
const BRIEFING_COUNT = 10;

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

function loadBriefings(): Record<string, DailyBriefingData> {
  try {
    const raw = localStorage.getItem(BRIEFING_KEY);
    if (raw) return JSON.parse(raw) as Record<string, DailyBriefingData>;
  } catch { /* ignore */ }
  return {};
}

function saveBriefings(data: Record<string, DailyBriefingData>) {
  localStorage.setItem(BRIEFING_KEY, JSON.stringify(data));
}

function pruneOldBriefings(data: Record<string, DailyBriefingData>): Record<string, DailyBriefingData> {
  const today = new Date();
  const result: Record<string, DailyBriefingData> = {};
  for (const [date, val] of Object.entries(data)) {
    const d = new Date(date);
    const diff = (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    if (diff < MAX_STORED_DAYS) {
      result[date] = val;
    }
  }
  return result;
}

const TREND_STYLES: Record<string, { color: string; bg: string }> = {
  "暴涨": { color: "#F43F5E", bg: "rgba(244,63,94,0.1)" },
  "潜力黑马": { color: "#8B5CF6", bg: "rgba(139,92,246,0.1)" },
  "降温": { color: "#3B82F6", bg: "rgba(59,130,246,0.1)" },
  "平稳": { color: "#94A3B8", bg: "rgba(148,163,184,0.1)" },
};

interface HotWord {
  title: string;
  platform: string;
}

export function DailyBriefing({ monitoredKeywords, onSearch, onOpenMonitor }: DailyBriefingProps) {
  const { isDark } = useTheme();
  const [briefing, setBriefing] = useState<DailyBriefingData | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, keyword: "" });
  const [viewDate, setViewDate] = useState(getTodayStr());
  const [hotWords, setHotWords] = useState<HotWord[]>([]);
  const abortRef = useRef(false);

  // Fetch hot words from hotboards
  useEffect(() => {
    const fetchHotWords = async () => {
      try {
        const res = await fetch("/api/hotboards");
        const data = await res.json();
        const boards = data.boards || [];
        const words: HotWord[] = [];
        for (const board of boards) {
          const items = board.items || [];
          for (let i = 0; i < Math.min(3, items.length); i++) {
            words.push({ title: items[i].title, platform: board.name });
          }
        }
        setHotWords(words);
      } catch {
        // Ignore errors
      }
    };
    fetchHotWords();
  }, []);

  // Load existing briefing or trigger auto-scan
  useEffect(() => {
    const allBriefings = loadBriefings();
    const today = getTodayStr();
    const lastDate = localStorage.getItem(LAST_REPORT_KEY);

    if (allBriefings[today]) {
      setBriefing(allBriefings[today]);
      setViewDate(today);
    } else if (lastDate !== today && monitoredKeywords.length > 0) {
      // Auto-scan
      triggerScan(monitoredKeywords);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerScan = useCallback(async (keywords: string[]) => {
    if (scanning || keywords.length === 0) return;
    setScanning(true);
    abortRef.current = false;
    const today = getTodayStr();
    setViewDate(today);

    const items: BriefingItem[] = [];
    for (let i = 0; i < keywords.length; i++) {
      if (abortRef.current) break;
      const kw = keywords[i];
      setScanProgress({ current: i + 1, total: keywords.length, keyword: kw });

      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: kw, timeRange: "1d", count: BRIEFING_COUNT, stream: false }),
        });
        const data = await res.json();
        if (data.topics && Array.isArray(data.topics)) {
          items.push({
            keyword: kw,
            topics: data.topics.slice(0, 3),
            scannedAt: new Date().toISOString(),
          });
        } else {
          items.push({ keyword: kw, topics: [], scannedAt: new Date().toISOString(), error: "未获取到数据" });
        }
      } catch {
        items.push({ keyword: kw, topics: [], scannedAt: new Date().toISOString(), error: "扫描失败" });
      }
    }

    const briefingData: DailyBriefingData = {
      date: today,
      items,
      generatedAt: new Date().toISOString(),
    };

    // Save
    const allBriefings = pruneOldBriefings(loadBriefings());
    allBriefings[today] = briefingData;
    saveBriefings(allBriefings);
    localStorage.setItem(LAST_REPORT_KEY, today);

    setBriefing(briefingData);
    setScanning(false);
  }, [scanning]);

  const handleRegenerate = useCallback(() => {
    if (monitoredKeywords.length > 0) {
      triggerScan(monitoredKeywords);
    }
  }, [monitoredKeywords, triggerScan]);

  // Get available dates for navigation
  const allBriefings = loadBriefings();
  const availableDates = Object.keys(allBriefings).sort().reverse();

  const handleDateChange = useCallback((date: string) => {
    setViewDate(date);
    const data = loadBriefings();
    if (data[date]) setBriefing(data[date]);
  }, []);

  // Merge all topics and sort by score
  const allTopics = briefing
    ? briefing.items
        .flatMap(item => item.topics.map(t => ({ ...t, _keyword: item.keyword })))
        .sort((a, b) => b.score - a.score)
    : [];

  // Show setup guide if no keywords
  if (monitoredKeywords.length === 0 && !scanning) {
    return (
      <div className={`rounded-[14px] border p-5 text-center ${
        isDark ? "border-[rgba(148,163,184,0.08)] bg-[rgba(22,27,45,0.6)]" : "border-[rgba(0,0,0,0.04)] bg-white"
      }`}>
        <span className="mb-2 block text-2xl">📡</span>
        <h3 className={`text-sm font-semibold ${isDark ? "text-[#F1F5F9]" : "text-[#0F172A]"}`}>
          开启每日选题简报
        </h3>
        <p className={`mt-1 text-xs leading-relaxed ${isDark ? "text-[#64748B]" : "text-[#94A3B8]"}`}>
          设置监控关键词，每天首次打开自动生成选题简报
        </p>
        <button
          type="button"
          onClick={onOpenMonitor}
          className={`mt-3 rounded-lg px-4 py-2 text-xs font-medium transition-all ${
            isDark
              ? "bg-[#00C6ED]/10 text-[#00C6ED] hover:bg-[#00C6ED]/20"
              : "bg-[#00B4D8]/10 text-[#00B4D8] hover:bg-[#00B4D8]/20"
          }`}
        >
          设置监控关键词
        </button>
      </div>
    );
  }

  // Scanning state
  if (scanning) {
    return (
      <div className={`rounded-[14px] border p-5 ${
        isDark ? "border-[rgba(148,163,184,0.08)] bg-[rgba(22,27,45,0.6)]" : "border-[rgba(0,0,0,0.04)] bg-white"
      }`}>
        <div className="flex items-center gap-3">
          <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none" className="absolute inset-0">
              <circle cx="16" cy="16" r="14" stroke="#00C6ED" strokeWidth="1.5" strokeOpacity="0.25" />
              <circle cx="16" cy="16" r="1.5" fill="#00C6ED" />
            </svg>
            <span className="absolute inset-0 rounded-full" style={{ animation: "radar-pulse 1.5s ease-in-out infinite" }}>
              <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="14" stroke="#00C6ED" strokeWidth="1.5" fill="none" />
              </svg>
            </span>
          </div>
          <span className={`text-sm ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}>
            正在扫描监控关键词…（{scanProgress.current}/{scanProgress.total}）{scanProgress.keyword}
          </span>
        </div>
        <div className={`relative mt-3 h-1.5 w-full overflow-hidden rounded-full ${isDark ? "bg-[rgba(148,163,184,0.08)]" : "bg-[rgba(0,0,0,0.06)]"}`}>
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#00C6ED] to-[#8B5CF6] transition-all duration-500"
            style={{ width: `${scanProgress.total > 0 ? (scanProgress.current / scanProgress.total) * 100 : 0}%` }}
          />
        </div>
      </div>
    );
  }

  // Empty state
  if (!briefing || allTopics.length === 0) {
    return (
      <div className={`rounded-[14px] border p-5 text-center ${
        isDark ? "border-[rgba(148,163,184,0.08)] bg-[rgba(22,27,45,0.6)]" : "border-[rgba(0,0,0,0.04)] bg-white"
      }`}>
        <p className={`text-sm ${isDark ? "text-[#64748B]" : "text-[#94A3B8]"}`}>
          {briefing ? "今日简报暂无数据" : "暂无简报"}
        </p>
        <button
          type="button"
          onClick={handleRegenerate}
          className={`mt-2 rounded-lg px-4 py-2 text-xs font-medium transition-all ${
            isDark
              ? "bg-[#00C6ED]/10 text-[#00C6ED] hover:bg-[#00C6ED]/20"
              : "bg-[#00B4D8]/10 text-[#00B4D8] hover:bg-[#00B4D8]/20"
          }`}
        >
          重新生成今日简报
        </button>
      </div>
    );
  }

  const genTime = new Date(briefing.generatedAt);
  const timeStr = `${genTime.getHours().toString().padStart(2, "0")}:${genTime.getMinutes().toString().padStart(2, "0")}`;

  return (
    <div className="space-y-3">
      {/* Hot Words Section */}
      {hotWords.length > 0 && (
        <div className={`rounded-[14px] border p-4 ${
          isDark ? "border-[rgba(148,163,184,0.08)] bg-[rgba(22,27,45,0.6)]" : "border-[rgba(0,0,0,0.04)] bg-white"
        }`}>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm">🔥</span>
            <span className={`text-xs font-medium ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}>
              今日全网热词
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {hotWords.map((hw, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSearch(hw.title)}
                className={`group flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-all ${
                  isDark
                    ? "bg-[rgba(148,163,184,0.08)] text-[#94A3B8] hover:bg-[rgba(0,198,237,0.15)] hover:text-[#00C6ED]"
                    : "bg-[rgba(0,0,0,0.04)] text-[#64748B] hover:bg-[rgba(0,180,216,0.1)] hover:text-[#00B4D8]"
                }`}
              >
                <span className={`text-[10px] ${isDark ? "text-[#475569]" : "text-[#94A3B8]"}`}>
                  {hw.platform.replace("热搜", "").replace("热榜", "")}
                </span>
                <span className="max-w-[120px] truncate">{hw.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">📡</span>
          <h2 className={`text-base font-semibold ${isDark ? "text-[#F1F5F9]" : "text-[#0F172A]"}`}>
            今日选题简报
          </h2>
          <span className={`text-xs ${isDark ? "text-[#475569]" : "text-[#94A3B8]"}`}>
            {briefing.date} {timeStr}扫描
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Date navigation */}
          {availableDates.length > 1 && (
            <select
              value={viewDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className={`rounded-lg border px-2 py-1 text-xs outline-none ${
                isDark
                  ? "border-[rgba(148,163,184,0.08)] bg-[rgba(15,23,42,0.6)] text-[#94A3B8]"
                  : "border-[rgba(0,0,0,0.06)] bg-white text-[#64748B]"
              }`}
            >
              {availableDates.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
          {viewDate === getTodayStr() && (
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={scanning}
              className={`rounded-lg px-2.5 py-1 text-xs transition-all disabled:opacity-50 ${
                isDark
                  ? "text-[#00C6ED]/70 hover:bg-[#00C6ED]/5 hover:text-[#00C6ED]"
                  : "text-[#00B4D8]/70 hover:bg-blue-50 hover:text-[#00B4D8]"
              }`}
            >
              重新生成
            </button>
          )}
        </div>
      </div>

      {/* Topics list */}
      <div className="space-y-1">
        {allTopics.slice(0, 15).map((topic, i) => {
          const trendStyle = TREND_STYLES[topic.trendTag] || TREND_STYLES["平稳"];
          return (
            <button
              key={topic.url || topic.id}
              type="button"
              onClick={() => onSearch(topic.title.slice(0, 15))}
              className={`card-stagger group flex items-center gap-3 rounded-xl px-4 py-2.5 text-left transition-all ${
                isDark ? "hover:bg-[rgba(22,27,45,0.8)]" : "hover:bg-white hover:shadow-sm"
              }`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                i < 3
                  ? (isDark ? "bg-[#F43F5E]/15 text-[#F43F5E]" : "bg-[#F43F5E]/10 text-[#F43F5E]")
                  : (isDark ? "bg-[rgba(148,163,184,0.06)] text-[#475569]" : "bg-[rgba(0,0,0,0.04)] text-[#94A3B8]")
              }`}>
                {i + 1}
              </span>
              <span className={`min-w-0 flex-1 truncate text-sm ${
                isDark ? "text-[#F1F5F9] group-hover:text-[#00C6ED]" : "text-[#0F172A] group-hover:text-[#00B4D8]"
              } transition-colors`}>
                {topic.title}
              </span>
              <span className="badge-trend shrink-0" style={{ color: trendStyle.color, backgroundColor: trendStyle.bg }}>
                {topic.trendTag}
              </span>
              <span className={`shrink-0 text-xs font-semibold ${
                topic.score >= 75 ? "text-[#F43F5E]" : topic.score >= 55 ? (isDark ? "text-[#00C6ED]" : "text-[#00B4D8]") : (isDark ? "text-[#94A3B8]" : "text-[#64748B]")
              }`}>
                {topic.score}
              </span>
              <span className={`hidden shrink-0 text-[10px] sm:inline ${isDark ? "text-[#475569]" : "text-[#CBD5E1]"}`}>
                {topic._keyword}
              </span>
            </button>
          );
        })}
      </div>

      {/* Error items */}
      {briefing.items.filter(item => item.error).length > 0 && (
        <div className={`rounded-lg px-3 py-2 text-xs ${isDark ? "bg-[rgba(245,158,11,0.06)] text-[#F59E0B]" : "bg-[rgba(245,158,11,0.04)] text-[#D97706]"}`}>
          {briefing.items.filter(item => item.error).map(item => (
            <span key={item.keyword}>{item.keyword}：{item.error} </span>
          ))}
        </div>
      )}
    </div>
  );
}

export { loadBriefings, getTodayStr, BRIEFING_KEY, LAST_REPORT_KEY };
