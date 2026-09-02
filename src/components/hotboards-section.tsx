"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "@/hooks/use-theme";

interface HotItem {
  title: string;
  hot: number;
  url: string;
}

interface HotBoard {
  key: string;
  name: string;
  icon: string;
  items: HotItem[];
  error?: string;
}

interface HotboardsSectionProps {
  onSearch: (keyword: string) => void;
}

const CACHE_KEY = "hotboards_cache";
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export function HotboardsSection({ onSearch }: HotboardsSectionProps) {
  const { isDark } = useTheme();
  const [boards, setBoards] = useState<HotBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadHotboards() {
      // Check cache first
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL && data.length > 0) {
            if (!cancelled) {
              setBoards(data);
              setLoading(false);
              return;
            }
          }
        }
      } catch {
        // ignore cache errors
      }

      setLoading(true);
      try {
        const res = await fetch("/api/hotboards");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        
        if (!cancelled) {
          const validBoards = (data.boards || []).filter((b: HotBoard) => b.items && b.items.length > 0);
          setBoards(validBoards);
          setError(validBoards.length === 0);
          
          // Cache the data
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
              data: validBoards,
              timestamp: Date.now(),
            }));
          } catch {
            // ignore storage errors
          }
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadHotboards();
    return () => { cancelled = true; };
  }, []);

  const handleItemClick = useCallback((title: string) => {
    // Extract keyword from title (first 15 chars or until punctuation)
    const keyword = title.replace(/[，。！？、\s].*$/, "").slice(0, 15);
    onSearch(keyword);
  }, [onSearch]);

  const formatHot = (hot: number): string => {
    if (hot >= 10000) return `${(hot / 10000).toFixed(1)}万`;
    if (hot >= 1000) return `${(hot / 1000).toFixed(1)}k`;
    return String(hot);
  };

  // Error state - show message instead of section
  if (error && boards.length === 0) {
    return (
      <section className={`rounded-2xl p-6 ${isDark ? "bg-[rgba(22,27,45,0.6)]" : "bg-white shadow-sm"}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">🔥</span>
          <h2 className={`text-base font-semibold ${isDark ? "text-[#F1F5F9]" : "text-[#0F172A]"}`}>
            全网热榜
          </h2>
        </div>
        <p className={`mt-4 text-center text-sm ${isDark ? "text-[#64748B]" : "text-[#94A3B8]"}`}>
          热榜暂时开小差，稍后再试
        </p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className={`rounded-2xl p-6 ${isDark ? "bg-[rgba(22,27,45,0.6)]" : "bg-white shadow-sm"}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">🔥</span>
          <h2 className={`text-base font-semibold ${isDark ? "text-[#F1F5F9]" : "text-[#0F172A]"}`}>
            全网热榜
          </h2>
          <div className="ml-auto flex items-center gap-1.5">
            <div className={`h-1 w-8 overflow-hidden rounded-full ${isDark ? "bg-[#1E293B]" : "bg-gray-200"}`}>
              <div className="h-full w-1/3 rounded-full bg-[#00C6ED]" style={{ animation: "progress 1.5s ease-in-out infinite" }} />
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className={`h-10 rounded-lg ${isDark ? "bg-[#1E293B]/50" : "bg-gray-100"}`} style={{ animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
      </section>
    );
  }

  if (boards.length === 0) return null;

  const currentBoard = boards[activeTab] || boards[0];

  return (
    <section className={`rounded-2xl p-6 ${isDark ? "bg-[rgba(22,27,45,0.6)]" : "bg-white shadow-sm"}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-lg">🔥</span>
        <h2 className={`text-base font-semibold ${isDark ? "text-[#F1F5F9]" : "text-[#0F172A]"}`}>
          全网热榜
        </h2>
        <span className={`ml-2 text-xs ${isDark ? "text-[#64748B]" : "text-[#94A3B8]"}`}>
          实时热搜
        </span>
      </div>

      {/* Platform Tabs */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {boards.map((board, i) => (
          <button
            key={board.key}
            type="button"
            onClick={() => setActiveTab(i)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              i === activeTab
                ? isDark
                  ? "bg-[#00C6ED]/15 text-[#00C6ED]"
                  : "bg-[#00C6ED]/10 text-[#00B4D8]"
                : isDark
                  ? "text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#F1F5F9]"
                  : "text-[#64748B] hover:bg-gray-100 hover:text-[#0F172A]"
            }`}
          >
            <span>{board.icon}</span>
            <span>{board.name}</span>
          </button>
        ))}
      </div>

      {/* Hot Items List */}
      <div className="mt-4 space-y-1">
        {currentBoard.items.slice(0, 15).map((item, i) => (
          <button
            key={`${currentBoard.key}-${i}`}
            type="button"
            onClick={() => handleItemClick(item.title)}
            className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-all ${
              isDark
                ? "hover:bg-[rgba(22,27,45,0.8)]"
                : "hover:bg-gray-50"
            }`}
          >
            {/* Rank */}
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-bold ${
              i < 3
                ? (isDark ? "bg-[#F43F5E]/15 text-[#F43F5E]" : "bg-[#F43F5E]/10 text-[#F43F5E]")
                : (isDark ? "text-[#64748B]" : "text-[#94A3B8]")
            }`}>
              {i + 1}
            </span>
            {/* Title */}
            <span className={`min-w-0 flex-1 truncate text-sm ${
              isDark ? "text-[#F1F5F9] group-hover:text-[#00C6ED]" : "text-[#0F172A] group-hover:text-[#00B4D8]"
            } transition-colors`}>
              {item.title}
            </span>
            {/* Hot value */}
            <span className={`shrink-0 text-xs ${isDark ? "text-[#64748B]" : "text-[#94A3B8]"}`}>
              {formatHot(item.hot)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
