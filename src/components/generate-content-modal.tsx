"use client";

import { useState, useCallback } from "react";
import { useTheme } from "@/hooks/use-theme";

interface GenerateContentModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  snippet: string;
}

type ContentType = "xiaohongshu" | "douyin" | "gongzhonghao";

const CONTENT_OPTIONS: { type: ContentType; label: string; icon: string; desc: string }[] = [
  { type: "xiaohongshu", label: "小红书笔记", icon: "📕", desc: "活泼种草风，带emoji和标签" },
  { type: "douyin", label: "抖音脚本", icon: "🎬", desc: "口播体，60秒短视频脚本" },
  { type: "gongzhonghao", label: "公众号文章", icon: "📝", desc: "深度长文，专业洞察" },
];

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
  const [selectedType, setSelectedType] = useState<ContentType | null>(null);
  const [generatedContent, setGeneratedContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { isDark } = useTheme();

  const handleGenerate = useCallback(async (type: ContentType) => {
    setSelectedType(type);
    setLoading(true);
    setError(null);
    setGeneratedContent("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, snippet, contentType: type }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "生成失败");
      }

      const data = await res.json();
      setGeneratedContent(data.content || "");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "生成失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [title, snippet]);

  const handleCopy = useCallback(async () => {
    if (!generatedContent) return;
    await copyToClipboard(generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generatedContent]);

  const handleClose = useCallback(() => {
    setSelectedType(null);
    setGeneratedContent("");
    setError(null);
    onClose();
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className={`absolute inset-0 ${isDark ? "bg-black/60" : "bg-black/40"} backdrop-blur-sm`} />
      <div className={`relative w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl ${
        isDark ? "border-[rgba(0,212,255,0.15)] bg-[#1A1F2E]" : "border-gray-200 bg-white"
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between border-b px-5 py-3.5 ${
          isDark ? "border-[rgba(0,212,255,0.08)]" : "border-gray-100"
        }`}>
          <h2 className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>生成内容</h2>
          <button type="button" onClick={handleClose} className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
            isDark ? "text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "text-gray-400 hover:bg-gray-100"
          }`}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {/* Topic reference */}
          <div className={`mb-4 rounded-xl border p-3 ${
            isDark ? "border-[rgba(0,212,255,0.08)] bg-[#12162A]/50" : "border-gray-100 bg-gray-50"
          }`}>
            <p className={`text-xs ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>基于热点生成：</p>
            <p className={`mt-1 text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>{title}</p>
          </div>

          {/* Content type selector (show when no content generated yet) */}
          {!generatedContent && !loading && (
            <div className="space-y-2.5">
              <p className={`text-xs ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>选择内容类型：</p>
              {CONTENT_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => handleGenerate(opt.type)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all hover:scale-[1.01] ${
                    isDark
                      ? "border-[rgba(0,212,255,0.1)] bg-[#12162A]/30 hover:border-[#00D4FF]/30 hover:bg-[#12162A]/60"
                      : "border-gray-100 bg-white hover:border-[#00B4D8]/30 hover:bg-blue-50/50"
                  }`}
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <div>
                    <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>{opt.label}</p>
                    <p className={`text-xs ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center py-8">
              <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#00D4FF]/20 border-t-[#00D4FF]" />
              <p className={`text-sm ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>
                正在生成{CONTENT_OPTIONS.find(o => o.type === selectedType)?.label || "内容"}...
              </p>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="flex flex-col items-center py-6">
              <p className="mb-3 text-sm text-[#FF4D6A]">{error}</p>
              <button
                type="button"
                onClick={() => { setError(null); if (selectedType) handleGenerate(selectedType); }}
                className="rounded-lg border border-[#00D4FF]/30 px-4 py-2 text-xs text-[#00D4FF] transition-all hover:bg-[#00D4FF]/5"
              >
                重试
              </button>
            </div>
          )}

          {/* Generated content */}
          {generatedContent && !loading && (
            <div>
              <div className={`mb-3 rounded-xl border p-4 ${
                isDark ? "border-[rgba(0,212,255,0.08)] bg-[#12162A]/30" : "border-gray-100 bg-gray-50"
              }`}>
                <pre className={`whitespace-pre-wrap text-sm leading-relaxed ${isDark ? "text-white/90" : "text-gray-800"}`}>
                  {generatedContent}
                </pre>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                    copied
                      ? "text-[#00E5A0]"
                      : "bg-[#00D4FF] text-[#0A0E1A] hover:shadow-[0_0_12px_rgba(0,212,255,0.3)]"
                  }`}
                >
                  {copied ? (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      已复制
                    </>
                  ) : (
                    "一键复制"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setGeneratedContent(""); setSelectedType(null); }}
                  className={`rounded-lg px-3 py-2 text-xs transition-all ${
                    isDark
                      ? "text-[#8B92A8] hover:bg-[#252B3D] hover:text-white"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  }`}
                >
                  重新生成
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
