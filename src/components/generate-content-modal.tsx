"use client";

import { useState, useCallback } from "react";
import { useTheme } from "@/hooks/use-theme";

interface GenerateContentModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  snippet: string;
}

type ContentMode = "content" | "titles" | "tags";

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

export function GenerateContentModal({ open, onClose, title, snippet }: GenerateContentModalProps) {
  const { isDark } = useTheme();
  const [mode, setMode] = useState<ContentMode>("content");
  const [contentType, setContentType] = useState<"xhs" | "douyin" | "wechat">("xhs");
  const [tone, setTone] = useState("专业");
  const [wordCount, setWordCount] = useState("500");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [previousResult, setPreviousResult] = useState<string | null>(null);

  const contentTypes = [
    { value: "xhs" as const, label: "小红书笔记", icon: "📕" },
    { value: "douyin" as const, label: "抖音脚本", icon: "🎬" },
    { value: "wechat" as const, label: "公众号文章", icon: "📝" },
  ];

  const buildPrompt = useCallback(() => {
    if (mode === "titles") {
      return `基于以下热点话题，生成5个吸引眼球的标题候选，包含悬念型、数字型、痛点型等不同风格。\n\n热点标题：${title}\n内容摘要：${snippet}\n\n请以编号列表格式输出5个标题，每个标题简洁有力，适合自媒体传播。`;
    }
    if (mode === "tags") {
      return `基于以下热点话题，生成10-15个相关的内容标签（hashtag），涵盖话题核心、受众群体、内容类型等维度。\n\n热点标题：${title}\n内容摘要：${snippet}\n\n请以逗号分隔的格式输出所有标签，适合直接复制使用。`;
    }
    // Content mode
    const typeMap = {
      xhs: "小红书笔记（标题+正文+标签，风格活泼有emoji，适合种草/分享）",
      douyin: "抖音口播脚本（开头hook+正文+结尾引导关注，口语化表达）",
      wechat: "公众号深度文章（标题+导语+正文段落，深度分析风格）",
    };
    return `基于以下热点话题，生成一篇${typeMap[contentType]}。\n语气风格：${tone}\n目标字数：约${wordCount}字\n\n热点标题：${title}\n内容摘要：${snippet}\n\n请直接输出完整内容，不要添加额外说明。`;
  }, [mode, contentType, tone, wordCount, title, snippet]);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (result) setPreviousResult(result);
    setResult("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: buildPrompt() }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || "生成失败");
      }
      const data = await response.json();
      setResult(data.content || "生成内容为空");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "生成失败，请重试");
    } finally {
      setLoading(false);
    }
  }, [buildPrompt, result]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    await copyToClipboard(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const handleRestorePrevious = useCallback(() => {
    if (previousResult) {
      setResult(previousResult);
      setPreviousResult(null);
    }
  }, [previousResult]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`absolute inset-0 ${isDark ? "bg-black/60" : "bg-black/40"} backdrop-blur-sm`} />
      <div className={`relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border shadow-2xl ${
        isDark ? "border-[rgba(0,212,255,0.15)] bg-[#1A1F2E]" : "border-gray-200 bg-white"
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between border-b px-5 py-3.5 ${isDark ? "border-[rgba(0,212,255,0.08)]" : "border-gray-100"}`}>
          <div className="flex items-center gap-2 min-w-0">
            <svg className={`h-4 w-4 shrink-0 ${isDark ? "text-[#00D4FF]" : "text-[#00B4D8]"}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
            </svg>
            <h2 className={`text-sm font-semibold truncate ${isDark ? "text-white" : "text-gray-900"}`}>AI 创作</h2>
            <span className={`text-xs truncate ${isDark ? "text-[#8B92A8]/50" : "text-gray-400"}`}>{title}</span>
          </div>
          <button type="button" onClick={onClose} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${isDark ? "text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "text-gray-400 hover:bg-gray-100"}`}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Mode tabs: P2-4/P2-5 */}
        <div className={`flex gap-1 border-b px-5 py-2.5 ${isDark ? "border-[rgba(0,212,255,0.08)]" : "border-gray-100"}`}>
          {([
            { value: "content" as const, label: "生成内容" },
            { value: "titles" as const, label: "标题候选" },
            { value: "tags" as const, label: "标签建议" },
          ]).map((tab) => (
            <button key={tab.value} type="button" onClick={() => { setMode(tab.value); setResult(""); setError(null); setPreviousResult(null); }} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              mode === tab.value
                ? (isDark ? "bg-[#00D4FF]/15 text-[#00D4FF]" : "bg-[#00B4D8]/10 text-[#00B4D8]")
                : (isDark ? "text-[#8B92A8] hover:text-white" : "text-gray-500 hover:text-gray-700")
            }`}>{tab.label}</button>
          ))}
        </div>

        {/* Options */}
        <div className="px-5 py-3 space-y-2.5">
          {mode === "content" && (
            <>
              <div className="flex gap-1.5">
                {contentTypes.map((ct) => (
                  <button key={ct.value} type="button" onClick={() => setContentType(ct.value)} className={`flex-1 rounded-xl border px-2 py-2 text-center transition-all ${
                    contentType === ct.value
                      ? (isDark ? "border-[#00D4FF]/40 bg-[#00D4FF]/8" : "border-[#00B4D8]/40 bg-blue-50")
                      : (isDark ? "border-[rgba(0,212,255,0.08)] text-[#8B92A8] hover:border-[#00D4FF]/20" : "border-gray-200 text-gray-500 hover:border-[#00B4D8]/20")
                  }`}>
                    <div className="text-base">{ct.icon}</div>
                    <div className={`mt-0.5 text-[11px] ${contentType === ct.value ? (isDark ? "text-[#00D4FF]" : "text-[#00B4D8]") : ""}`}>{ct.label}</div>
                  </button>
                ))}
              </div>
              {/* P2-4: Custom options */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className={`mb-1 block text-[11px] ${isDark ? "text-[#8B92A8]/60" : "text-gray-400"}`}>语气风格</label>
                  <select value={tone} onChange={(e) => setTone(e.target.value)} className={`w-full rounded-lg border px-2 py-1.5 text-xs outline-none ${isDark ? "border-[rgba(0,212,255,0.08)] bg-[#12162A] text-[#8B92A8]" : "border-gray-200 bg-white text-gray-600"}`}>
                    <option value="专业">专业</option>
                    <option value="活泼">活泼</option>
                    <option value="幽默">幽默</option>
                    <option value="走心">走心</option>
                    <option value="犀利">犀利</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className={`mb-1 block text-[11px] ${isDark ? "text-[#8B92A8]/60" : "text-gray-400"}`}>目标字数</label>
                  <select value={wordCount} onChange={(e) => setWordCount(e.target.value)} className={`w-full rounded-lg border px-2 py-1.5 text-xs outline-none ${isDark ? "border-[rgba(0,212,255,0.08)] bg-[#12162A] text-[#8B92A8]" : "border-gray-200 bg-white text-gray-600"}`}>
                    <option value="300">300字</option>
                    <option value="500">500字</option>
                    <option value="800">800字</option>
                    <option value="1200">1200字</option>
                  </select>
                </div>
              </div>
            </>
          )}
          {mode === "titles" && (
            <p className={`text-xs ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>生成5个不同风格的标题候选，含悬念型、数字型、痛点型</p>
          )}
          {mode === "tags" && (
            <p className={`text-xs ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>生成10-15个相关标签，涵盖话题核心、受众、类型</p>
          )}
        </div>

        {/* Generate button */}
        <div className="px-5 pb-2">
          <button type="button" onClick={handleGenerate} disabled={loading} className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
            isDark
              ? "bg-[#00D4FF] text-[#0A0E1A] hover:shadow-[0_0_16px_rgba(0,212,255,0.3)]"
              : "bg-[#00B4D8] text-white hover:shadow-[0_0_16px_rgba(0,180,216,0.3)]"
          }`}>
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                AI 生成中...
              </>
            ) : (mode === "content" ? "生成内容" : mode === "titles" ? "生成标题" : "生成标签")}
          </button>
        </div>

        {/* Result area */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {error && (
            <div className={`rounded-xl border px-3 py-2.5 text-xs ${isDark ? "border-[#FF4D6A]/20 bg-[#FF4D6A]/5 text-[#FF4D6A]" : "border-red-200 bg-red-50 text-red-500"}`}>
              {error}
            </div>
          )}
          {result && !error && (
            <div>
              {/* P2-4: Previous result restore */}
              {previousResult && (
                <button type="button" onClick={handleRestorePrevious} className={`mb-2 text-xs ${isDark ? "text-[#8B92A8]/60 hover:text-[#00D4FF]" : "text-gray-400 hover:text-[#00B4D8]"}`}>
                  ← 恢复上一版
                </button>
              )}
              <div className={`rounded-xl border p-3.5 ${isDark ? "border-[rgba(0,212,255,0.08)] bg-[#12162A]/50" : "border-gray-100 bg-gray-50"}`}>
                <pre className={`whitespace-pre-wrap break-words font-sans text-sm leading-relaxed ${isDark ? "text-white" : "text-gray-800"}`}>{result}</pre>
              </div>
              <div className="mt-2 flex justify-end">
                <button type="button" onClick={handleCopy} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all ${
                  copied
                    ? "text-[#00E5A0]"
                    : isDark ? "text-[#00D4FF] hover:bg-[#00D4FF]/8" : "text-[#00B4D8] hover:bg-blue-50"
                }`}>
                  {copied ? (
                    <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>已复制</>
                  ) : (
                    <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" /></svg>一键复制</>
                  )}
                </button>
              </div>
            </div>
          )}
          {!result && !error && !loading && (
            <div className={`flex h-24 items-center justify-center text-xs ${isDark ? "text-[#8B92A8]/40" : "text-gray-300"}`}>
              点击上方按钮开始生成
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
