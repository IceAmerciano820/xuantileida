"use client";

import { useState, useCallback, type FormEvent } from "react";
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

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchedKeyword, setSearchedKeyword] = useState("");

  const handleSearch = useCallback(async (keyword: string) => {
    if (!keyword.trim()) return;

    setLoading(true);
    setError(null);
    setResults(null);
    setSearchedKeyword(keyword.trim());

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim() }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `请求失败 (${response.status})`);
      }

      const data: SearchResponse = await response.json();
      setResults(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "搜索失败，请稍后重试";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const keyword = formData.get("keyword") as string;
      handleSearch(keyword);
    },
    [handleSearch]
  );

  const suggestedKeywords = ["搞钱", "副业", "AI工具", "自媒体", "效率提升", "职场"];

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      {/* Header */}
      <header className="border-b border-[#E7E5E4] bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
              <svg
                className="h-5 w-5 text-amber-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[#1C1917]">
                热点灵感采集
              </h1>
              <p className="text-xs text-[#78716C]">
                发现热门话题，获取创作灵感
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Search Section */}
        <section className="mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <SearchInput loading={loading} />
          </form>

          {/* Suggested Keywords */}
          {!loading && !results && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-sm text-[#78716C]">试试：</span>
              {suggestedKeywords.map((kw) => (
                <button
                  key={kw}
                  type="button"
                  onClick={() => handleSearch(kw)}
                  className="rounded-md border border-[#E7E5E4] bg-white px-3 py-1.5 text-sm text-[#57534E] transition-all hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 active:scale-95"
                >
                  {kw}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Loading State */}
        {loading && <LoadingSkeleton />}

        {/* Error State */}
        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-center">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !results && !error && <EmptyState />}

        {/* Results */}
        {results && (
          <section>
            {/* Results Header */}
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-[#78716C]">
                {results.topics.length > 0 ? (
                  <>
                    找到{" "}
                    <span className="font-medium text-[#1C1917]">
                      {results.totalFound ?? results.topics.length}
                    </span>{" "}
                    条与「{searchedKeyword}」相关的热点
                  </>
                ) : (
                  <span className="text-[#78716C]">{results.message}</span>
                )}
              </p>
              {results.topics.length > 0 && (
                <span className="text-xs text-[#A8A29E]">过去24小时</span>
              )}
            </div>

            {/* Result Cards */}
            <div className="space-y-4">
              {results.topics.map((topic, index) => (
                <ResultCard key={topic.id} topic={topic} index={index} />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E7E5E4] bg-white/50 py-4">
        <p className="text-center text-xs text-[#A8A29E]">
          数据来源：全网公开热点信息聚合 | 仅供选题参考
        </p>
      </footer>
    </div>
  );
}
