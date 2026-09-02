"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "@/hooks/use-theme";
import { HotboardsSection } from "@/components/hotboards-section";

interface QuickTopic {
  id: string;
  title: string;
  source: string;
  heatScore: number;
  publishTime: string;
  url: string;
}

interface LandingViewProps {
  onSearch: (keyword: string) => void;
}

const TRACK_CARDS = [
  { emoji: "🤖", name: "AI工具", desc: "智能工具新发现与实测", gradient: "from-[#00C6ED]/15 to-[#8B5CF6]/10" },
  { emoji: "💰", name: "副业搞钱", desc: "兼职副业与变现路径", gradient: "from-[#F59E0B]/15 to-[#F43F5E]/10" },
  { emoji: "📱", name: "科技数码", desc: "新品发布与行业趋势", gradient: "from-[#3B82F6]/15 to-[#00C6ED]/10" },
  { emoji: "🎬", name: "娱乐八卦", desc: "影视综艺热议话题", gradient: "from-[#EC4899]/15 to-[#8B5CF6]/10" },
  { emoji: "📚", name: "教育职场", desc: "考试公职职场晚八卦", gradient: "from-[#10B981]/15 to-[#3B82F6]/10" },
  { emoji: "🌿", name: "健康养生", desc: "养生保健运动减脂", gradient: "from-[#10B981]/15 to-[#F59E0B]/10" },
  { emoji: "💄", name: "美妆穿搭", desc: "护肤化妆时尚穿搭", gradient: "from-[#F43F5E]/15 to-[#EC4899]/10" },
  { emoji: "🍴", name: "美食旅行", desc: "美食探店旅行打卡", gradient: "from-[#F59E0B]/15 to-[#10B981]/10" },
];

const PREVIEW_KEYWORDS = ["AI 人工智能", "热门话题", "科技", "娱乐"];

export function LandingView({ onSearch }: LandingViewProps) {
  const { isDark } = useTheme();
  const [previewTopics, setPreviewTopics] = useState<QuickTopic[]>([]);
  const [previewLoading, setPreviewLoading] = useState(true);

  // Auto-load preview topics on mount
  useEffect(() => {
    let cancelled = false;
    async function loadPreview() {
      setPreviewLoading(true);
      try {
        const allTopics: QuickTopic[] = [];
        const promises = PREVIEW_KEYWORDS.map((kw) =>
          fetch("/api/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ keyword: kw, timeRange: "1d", count: 30, stream: false }),
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.topics && Array.isArray(data.topics)) {
                return data.topics.slice(0, 4).map((t: Record<string, unknown>) => ({
                  id: (t.id as string) || String(Math.random()),
                  title: t.title as string,
                  source: t.source as string,
                  heatScore: t.heatScore as number,
                  publishTime: t.publishTime as string,
                  url: t.url as string,
                }));
              }
              return [];
            })
            .catch(() => [] as QuickTopic[])
        );
        const results = await Promise.all(promises);
        if (cancelled) return;
        // Merge and dedup by title
        const seen = new Set<string>();
        for (const batch of results) {
          for (const topic of batch) {
            if (!seen.has(topic.title)) {
              seen.add(topic.title);
              allTopics.push(topic);
            }
          }
        }
        setPreviewTopics(allTopics.slice(0, 12));
      } catch {
        // silent
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }
    loadPreview();
    return () => { cancelled = true; };
  }, []);

  const handleTrackClick = useCallback((trackName: string) => {
    onSearch(trackName);
  }, [onSearch]);

  return (
    <div className="space-y-8">
      {/* Hot Boards Section */}
      <HotboardsSection onSearch={onSearch} />

      {/* Hot Topics Overview */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <span className="text-lg">🔥</span>
          <h2 className={`text-base font-semibold ${isDark ? "text-[#F1F5F9]" : "text-[#0F172A]"}`}>
            今日全网热点速览
          </h2>
          {previewLoading && (
            <div className="ml-auto flex items-center gap-1.5">
              <div className={`h-1 w-8 overflow-hidden rounded-full ${isDark ? "bg-[#1E293B]" : "bg-gray-200"}`}>
                <div className="h-full w-1/3 rounded-full bg-[#00C6ED]" style={{ animation: "progress 1.5s ease-in-out infinite" }} />
              </div>
              <span className={`text-xs ${isDark ? "text-[#64748B]" : "text-[#94A3B8]"}`}>加载中...</span>
            </div>
          )}
        </div>

        {previewTopics.length > 0 ? (
          <div className={`grid gap-2 ${isDark ? "" : ""}`}>
            {previewTopics.map((topic, i) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => onSearch(topic.title.slice(0, 15))}
                className={`card-stagger group flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all ${
                  isDark
                    ? "hover:bg-[rgba(22,27,45,0.8)]"
                    : "hover:bg-white hover:shadow-sm"
                }`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                  i < 3
                    ? (isDark ? "bg-[#F43F5E]/15 text-[#F43F5E]" : "bg-[#F43F5E]/10 text-[#F43F5E]")
                    : (isDark ? "bg-[#1E293B] text-[#64748B]" : "bg-gray-100 text-[#94A3B8]")
                }`}>
                  {i + 1}
                </span>
                <span className={`min-w-0 flex-1 truncate text-sm ${
                  isDark ? "text-[#F1F5F9] group-hover:text-[#00C6ED]" : "text-[#0F172A] group-hover:text-[#00B4D8]"
                } transition-colors`}>
                  {topic.title}
                </span>
                <span className={`shrink-0 text-xs ${isDark ? "text-[#64748B]" : "text-[#94A3B8]"}`}>
                  {topic.source}
                </span>
                <span className={`shrink-0 text-xs font-medium ${
                  topic.heatScore >= 70
                    ? (isDark ? "text-[#F43F5E]" : "text-[#F43F5E]")
                    : (isDark ? "text-[#94A3B8]" : "text-[#64748B]")
                }`}>
                  🔥 {topic.heatScore}
                </span>
              </button>
            ))}
          </div>
        ) : !previewLoading ? (
          <div className={`rounded-xl py-8 text-center ${isDark ? "text-[#64748B]" : "text-[#94A3B8]"}`}>
            <p className="text-sm">暂无热点数据，请输入关键词开始探索</p>
          </div>
        ) : null}
      </section>

      {/* Track Exploration */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <span className="text-lg">🧭</span>
          <h2 className={`text-base font-semibold ${isDark ? "text-[#F1F5F9]" : "text-[#0F172A]"}`}>
            赛道探索
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TRACK_CARDS.map((track, i) => (
            <button
              key={track.name}
              type="button"
              onClick={() => handleTrackClick(track.name)}
              className={`card-stagger group relative overflow-hidden rounded-[14px] p-4 text-left transition-all duration-300 ${
                isDark
                  ? "border border-[rgba(148,163,184,0.06)] bg-[rgba(22,27,45,0.6)] hover:border-[rgba(0,198,237,0.2)] hover:bg-[rgba(22,27,45,0.9)]"
                  : "border border-[rgba(0,0,0,0.04)] bg-white hover:border-[rgba(0,198,237,0.2)] hover:shadow-md"
              }`}
              style={{ animationDelay: `${i * 60 + 200}ms` }}
            >
              {/* Gradient background on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${track.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
              <div className="relative">
                <span className="mb-2 block text-2xl">{track.emoji}</span>
                <h3 className={`text-sm font-semibold ${isDark ? "text-[#F1F5F9]" : "text-[#0F172A]"}`}>
                  {track.name}
                </h3>
                <p className={`mt-1 text-xs leading-relaxed ${isDark ? "text-[#64748B]" : "text-[#94A3B8]"}`}>
                  {track.desc}
                </p>
              </div>
              {/* Arrow indicator */}
              <div className={`absolute right-3 top-3 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0.5 ${
                isDark ? "text-[#00C6ED]" : "text-[#00B4D8]"
              }`}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
