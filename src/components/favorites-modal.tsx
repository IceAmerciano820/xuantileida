"use client";

import { useCallback, useState } from "react";
import { useTheme } from "@/hooks/use-theme";
import type { TopicAngle } from "@/app/page";

interface FavoritesModalProps {
  open: boolean;
  onClose: () => void;
  favorites: TopicAngle[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

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

export function FavoritesModal({ open, onClose, favorites, onRemove, onClear }: FavoritesModalProps) {
  const { isDark } = useTheme();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = useCallback(async (topic: TopicAngle) => {
    const text = [
      topic.title,
      `来源: ${topic.source} | 热度: ${topic.heatScore}`,
      topic.url ? `链接: ${topic.url}` : "",
      "",
      "创作切入角度:",
      ...topic.angles.map((a, i) => `  ${i + 1}. ${a}`),
    ].filter(Boolean).join("\n");
    await copyToClipboard(text);
    setCopiedId(topic.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`absolute inset-0 ${isDark ? "bg-black/60" : "bg-black/40"} backdrop-blur-sm`} />
      <div className={`relative w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl ${
        isDark ? "border-[rgba(0,212,255,0.15)] bg-[#1A1F2E]" : "border-gray-200 bg-white"
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between border-b px-5 py-3.5 ${
          isDark ? "border-[rgba(0,212,255,0.08)]" : "border-gray-100"
        }`}>
          <div className="flex items-center gap-2">
            <svg className={`h-4 w-4 ${isDark ? "text-[#00D4FF]" : "text-[#00B4D8]"}`} fill="currentColor" viewBox="0 0 24 24">
              <path d="m5.863 2.488 5.326 10.786a.75.75 0 0 0 1.35 0l5.327-10.786C18.676.928 17.426-.5 15.789-.5H8.21c-1.636 0-2.887 1.428-2.348 2.988Z" transform="translate(0, 2)" />
            </svg>
            <h2 className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
              我的灵感库 <span className={`font-normal ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>({favorites.length})</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {favorites.length > 0 && (
              <button type="button" onClick={onClear} className="text-xs text-[#FF4D6A]/70 hover:text-[#FF4D6A]">
                清空
              </button>
            )}
            <button type="button" onClick={onClose} className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
              isDark ? "text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "text-gray-400 hover:bg-gray-100"
            }`}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto">
          {favorites.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <svg className={`mb-3 h-10 w-10 ${isDark ? "text-[#8B92A8]/30" : "text-gray-300"}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.06.472 1.736 1.55 1.736 2.74v13.876c0 1.19-.676 2.268-1.736 2.74l-7.5 3.33a.75.75 0 0 1-.612 0l-7.5-3.33c-1.06-.472-1.736-1.55-1.736-2.74V6.062c0-1.19.676-2.268 1.736-2.74l7.5-3.33a.75.75 0 0 1 .612 0l7.5 3.33Z" />
              </svg>
              <p className={`text-sm ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>还没有收藏的灵感</p>
              <p className={`mt-1 text-xs ${isDark ? "text-[#8B92A8]/50" : "text-gray-400"}`}>点击热点卡片上的书签图标添加收藏</p>
            </div>
          ) : (
            <div className="divide-y divide-[rgba(0,212,255,0.06)]">
              {favorites.map((topic) => (
                <div key={topic.id} className={`px-5 py-3.5 transition-colors ${isDark ? "hover:bg-[#252B3D]/30" : "hover:bg-gray-50"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className={`text-sm font-medium leading-snug ${isDark ? "text-white" : "text-gray-900"}`}>
                        {topic.url ? (
                          <a href={topic.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#00D4FF] transition-colors">
                            {topic.title}
                          </a>
                        ) : topic.title}
                      </h4>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`text-xs ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>{topic.source}</span>
                        <span className={`text-xs ${isDark ? "text-[#8B92A8]/50" : "text-gray-400"}`}>·</span>
                        <span className="text-xs">🔥 {topic.heatScore}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopy(topic)}
                        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                          copiedId === topic.id
                            ? "text-[#00E5A0]"
                            : isDark
                              ? "text-[#8B92A8] hover:bg-[#252B3D] hover:text-[#00D4FF]"
                              : "text-gray-400 hover:bg-gray-100 hover:text-[#00B4D8]"
                        }`}
                        title="复制"
                      >
                        {copiedId === topic.id ? (
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        ) : (
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(topic.id)}
                        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                          isDark
                            ? "text-[#8B92A8] hover:bg-[#FF4D6A]/10 hover:text-[#FF4D6A]"
                            : "text-gray-400 hover:bg-red-50 hover:text-red-500"
                        }`}
                        title="取消收藏"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
