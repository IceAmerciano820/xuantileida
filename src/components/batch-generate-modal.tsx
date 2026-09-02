"use client";

import { useState, useCallback, useRef } from "react";
import { useTheme } from "@/hooks/use-theme";
import type { TopicAngle, GeneratedContentItem, GeneratedContentSet } from "@/app/page";

interface BatchGenerateModalProps {
  open: boolean;
  onClose: () => void;
  topics: TopicAngle[];
  onSaveToFavorite?: (topicKey: string, content: GeneratedContentSet) => void;
}

interface GenerationResult {
  topicKey: string;
  topicTitle: string;
  items: (GeneratedContentItem | null)[]; // null = failed
  completed: boolean;
}

type Platform = "xiaohongshu" | "douyin" | "wechat";

const PLATFORM_CONFIG: Record<Platform, { label: string; icon: string; promptSuffix: string }> = {
  xiaohongshu: {
    label: "小红书",
    icon: "📕",
    promptSuffix: "写一篇200-300字的小红书笔记，要求：标题候选3个（口语化、带具体信息）、正文有真实细节感、标签8-12个混合大词和长尾词",
  },
  douyin: {
    label: "抖音",
    icon: "🎬",
    promptSuffix: "写一个60秒抖音口播脚本，要求：前3秒必须有钩子（问题/反差/画面）、句子短口语化适合念出来、结尾引导自然",
  },
  wechat: {
    label: "公众号",
    icon: "📢",
    promptSuffix: "写一篇500字左右的公众号文章，要求：开头直接抛观点或故事、段落短每段一个意思、有个人判断和经验之谈",
  },
};

const PLATFORMS: Platform[] = ["xiaohongshu", "douyin", "wechat"];

function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) return navigator.clipboard.writeText(text);
  return new Promise((resolve) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    resolve();
  });
}

export function BatchGenerateModal({ open, onClose, topics, onSaveToFavorite }: BatchGenerateModalProps) {
  const { isDark } = useTheme();
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, platform: "" });
  const [activeResultIdx, setActiveResultIdx] = useState(0);
  const [activePlatform, setActivePlatform] = useState<Platform>("xiaohongshu");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const abortRef = useRef(false);

  const generateForPlatform = useCallback(async (topic: TopicAngle, platform: Platform): Promise<GeneratedContentItem | null> => {
    const config = PLATFORM_CONFIG[platform];
    const prompt = `基于以下热点话题，${config.promptSuffix}。\n\n话题标题：${topic.title}\n话题来源：${topic.source}\n话题摘要：${topic.snippet}\n创作切入角度：${topic.angles.join("；")}`;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.content) return null;

      // Parse title candidates from content (first line as title)
      const lines = data.content.split("\n").filter(Boolean);
      const title = lines[0]?.replace(/^[#*]+\s*/, "") || topic.title;

      return {
        platform,
        title,
        body: data.content,
        generatedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (topics.length === 0) return;
    setIsGenerating(true);
    abortRef.current = false;
    setResults([]);
    setActiveResultIdx(0);
    setActivePlatform("xiaohongshu");

    const totalTasks = topics.length * PLATFORMS.length;
    let completedTasks = 0;

    const newResults: GenerationResult[] = topics.map((t) => ({
      topicKey: t.url || t.id,
      topicTitle: t.title,
      items: [null, null, null],
      completed: false,
    }));

    // Process topics sequentially, platforms in parallel (max 3 concurrent)
    for (let i = 0; i < topics.length; i++) {
      if (abortRef.current) break;
      const topic = topics[i];

      // Generate all 3 platforms for this topic in parallel
      const platformPromises = PLATFORMS.map(async (platform, pIdx) => {
        setProgress({
          current: completedTasks,
          total: totalTasks,
          platform: PLATFORM_CONFIG[platform].label,
        });
        const result = await generateForPlatform(topic, platform);
        completedTasks++;
        setProgress({
          current: completedTasks,
          total: totalTasks,
          platform: PLATFORM_CONFIG[platform].label,
        });
        return { pIdx, result };
      });

      const platformResults = await Promise.all(platformPromises);
      platformResults.forEach(({ pIdx, result }) => {
        newResults[i].items[pIdx] = result;
      });
      newResults[i].completed = true;
      setResults([...newResults]);
    }

    setIsGenerating(false);
  }, [topics, generateForPlatform]);

  const handleRetry = useCallback(async (resultIdx: number, platformIdx: number) => {
    const topic = topics[resultIdx];
    if (!topic) return;
    const platform = PLATFORMS[platformIdx];
    const result = await generateForPlatform(topic, platform);
    setResults((prev) => {
      const next = [...prev];
      next[resultIdx] = { ...next[resultIdx], items: [...next[resultIdx].items] };
      next[resultIdx].items[platformIdx] = result;
      return next;
    });
  }, [topics, generateForPlatform]);

  const handleCopy = useCallback(async (content: string, key: string) => {
    await copyToClipboard(content);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  const handleSaveToFavorite = useCallback((resultIdx: number) => {
    const result = results[resultIdx];
    if (!result || !onSaveToFavorite) return;
    const validItems = result.items.filter((item): item is GeneratedContentItem => item !== null);
    if (validItems.length === 0) return;
    onSaveToFavorite(result.topicKey, {
      items: validItems,
      generatedAt: new Date().toISOString(),
    });
  }, [results, onSaveToFavorite]);

  const handleCancel = useCallback(() => {
    abortRef.current = true;
    setIsGenerating(false);
  }, []);

  if (!open) return null;

  const currentResult = results[activeResultIdx];
  const currentContent = currentResult?.items[PLATFORMS.indexOf(activePlatform)];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className={`relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${
          isDark
            ? "border-[rgba(148,163,184,0.1)] bg-[rgba(22,27,45,0.95)] backdrop-blur-xl"
            : "border-[rgba(0,0,0,0.06)] bg-white"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between border-b px-5 py-3 ${isDark ? "border-[rgba(148,163,184,0.08)]" : "border-[rgba(0,0,0,0.06)]"}`}>
          <div>
            <h3 className={`text-base font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
              批量生成内容包
            </h3>
            <p className={`mt-0.5 text-xs ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>
              为 {topics.length} 个选题生成小红书 / 抖音 / 公众号三平台内容
            </p>
          </div>
          <button type="button" onClick={onClose} className={`rounded-lg p-1.5 transition-colors ${isDark ? "text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "text-gray-400 hover:bg-gray-100"}`}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {!isGenerating && results.length === 0 ? (
            /* Initial state - show topics to generate */
            <div>
              <p className={`mb-3 text-sm ${isDark ? "text-[#F1F5F9]" : "text-gray-700"}`}>
                将为以下 {topics.length} 个选题生成内容：
              </p>
              <div className="space-y-2">
                {topics.map((t, i) => (
                  <div key={i} className={`rounded-lg border p-3 ${isDark ? "border-[rgba(148,163,184,0.08)] bg-[rgba(255,255,255,0.02)]" : "border-gray-100 bg-gray-50"}`}>
                    <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>{t.title}</p>
                    <p className={`mt-0.5 text-xs ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>{t.source} · 热度 {t.heatScore}</p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#00C6ED] to-[#0091FF] px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-[#00C6ED]/20 transition-all hover:shadow-xl hover:shadow-[#00C6ED]/30"
              >
                开始生成（共 {topics.length * 3} 篇）
              </button>
            </div>
          ) : isGenerating ? (
            /* Generating state - show progress */
            <div className="flex flex-col items-center py-8">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-2 border-[#00C6ED]/20 border-t-[#00C6ED]" />
              <p className={`mb-2 text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                正在生成 {Math.floor(progress.current / 3) + 1}/{topics.length} 条热点 · {progress.platform}
              </p>
              <p className={`mb-4 text-xs ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>
                总进度 {progress.current}/{progress.total}
              </p>
              <div className={`h-2 w-64 overflow-hidden rounded-full ${isDark ? "bg-[rgba(148,163,184,0.1)]" : "bg-gray-100"}`}>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#00C6ED] to-[#0091FF] transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className={`mt-6 rounded-lg px-4 py-1.5 text-xs transition-colors ${isDark ? "text-[#8B92A8] hover:text-white" : "text-gray-500 hover:text-gray-900"}`}
              >
                取消
              </button>
            </div>
          ) : (
            /* Results state */
            <div>
              {/* Topic tabs */}
              <div className={`mb-4 flex gap-1 overflow-x-auto border-b pb-2 ${isDark ? "border-[rgba(148,163,184,0.08)]" : "border-[rgba(0,0,0,0.06)]"}`}>
                {results.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setActiveResultIdx(i); setActivePlatform("xiaohongshu"); }}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      activeResultIdx === i
                        ? (isDark ? "bg-[#00C6ED]/15 text-[#00C6ED]" : "bg-[#00B4D8]/10 text-[#00B4D8]")
                        : (isDark ? "text-[#64748B] hover:text-[#F1F5F9]" : "text-[#94A3B8] hover:text-[#0F172A]")
                    }`}
                  >
                    选题 {i + 1}
                    {r.items.filter(Boolean).length === 3 && " ✓"}
                  </button>
                ))}
              </div>

              {currentResult && (
                <div>
                  <p className={`mb-3 text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                    {currentResult.topicTitle}
                  </p>

                  {/* Platform tabs */}
                  <div className={`mb-4 flex gap-1 rounded-lg p-1 ${isDark ? "bg-[rgba(148,163,184,0.06)]" : "bg-gray-100"}`}>
                    {PLATFORMS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setActivePlatform(p)}
                        className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                          activePlatform === p
                            ? (isDark ? "bg-[rgba(255,255,255,0.08)] text-white shadow-sm" : "bg-white text-gray-900 shadow-sm")
                            : (isDark ? "text-[#8B92A8] hover:text-white" : "text-gray-500 hover:text-gray-900")
                        }`}
                      >
                        {PLATFORM_CONFIG[p].icon} {PLATFORM_CONFIG[p].label}
                        {currentResult.items[PLATFORMS.indexOf(p)] === null && (
                          <span className="ml-1 text-[10px] text-[#F43F5E]">失败</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Content display */}
                  {currentContent ? (
                    <div className={`rounded-xl border p-4 ${isDark ? "border-[rgba(148,163,184,0.08)] bg-[rgba(255,255,255,0.02)]" : "border-gray-100 bg-gray-50"}`}>
                      <div className="mb-3 flex items-center justify-between">
                        <span className={`text-xs font-medium ${isDark ? "text-[#00C6ED]" : "text-[#00B4D8]"}`}>
                          {PLATFORM_CONFIG[activePlatform].icon} {PLATFORM_CONFIG[activePlatform].label}内容
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(currentContent.body, `${activeResultIdx}-${activePlatform}`)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                            copiedKey === `${activeResultIdx}-${activePlatform}`
                              ? "bg-[#10B981]/15 text-[#10B981]"
                              : (isDark ? "bg-[rgba(148,163,184,0.1)] text-[#8B92A8] hover:text-white" : "bg-gray-100 text-gray-500 hover:text-gray-900")
                          }`}
                        >
                          {copiedKey === `${activeResultIdx}-${activePlatform}` ? "✓ 已复制" : "复制全文"}
                        </button>
                      </div>
                      <div className={`whitespace-pre-wrap text-sm leading-relaxed ${isDark ? "text-[#F1F5F9]" : "text-gray-700"}`}>
                        {currentContent.body}
                      </div>
                    </div>
                  ) : (
                    <div className={`rounded-xl border p-6 text-center ${isDark ? "border-[rgba(148,163,184,0.08)] bg-[rgba(244,63,94,0.05)]" : "border-red-100 bg-red-50"}`}>
                      <p className={`mb-2 text-sm ${isDark ? "text-[#F43F5E]" : "text-red-600"}`}>生成失败</p>
                      <button
                        type="button"
                        onClick={() => handleRetry(activeResultIdx, PLATFORMS.indexOf(activePlatform))}
                        className="rounded-lg bg-[#F43F5E]/15 px-3 py-1.5 text-xs font-medium text-[#F43F5E] transition-colors hover:bg-[#F43F5E]/25"
                      >
                        重试
                      </button>
                    </div>
                  )}

                  {/* Save to favorite button */}
                  {onSaveToFavorite && currentResult.items.some(Boolean) && (
                    <button
                      type="button"
                      onClick={() => handleSaveToFavorite(activeResultIdx)}
                      className={`mt-4 w-full rounded-lg border px-4 py-2 text-xs font-medium transition-all ${
                        isDark
                          ? "border-[rgba(0,198,237,0.2)] bg-[rgba(0,198,237,0.05)] text-[#00C6ED] hover:bg-[rgba(0,198,237,0.1)]"
                          : "border-[#00B4D8]/20 bg-[#00B4D8]/5 text-[#00B4D8] hover:bg-[#00B4D8]/10"
                      }`}
                    >
                      保存到灵感库（关联此选题）
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
