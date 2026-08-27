"use client";

import { useCallback, useState } from "react";
import { useTheme } from "@/hooks/use-theme";
import type { TopicAngle } from "@/app/page";

interface FavoritesModalProps {
  open: boolean;
  onClose: () => void;
  favorites: TopicAngle[];
  onRemove: (url: string) => void;
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

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function FavoritesModal({ open, onClose, favorites, onRemove, onClear }: FavoritesModalProps) {
  const { isDark } = useTheme();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

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
    setCopiedId(topic.url || topic.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // P1-5: Export favorites
  const buildMarkdown = useCallback(() => {
    return favorites.map((t, i) =>
      `## ${i + 1}. ${t.title}\n\n- **来源**: ${t.source}\n- **热度**: ${t.heatScore}\n- **时间**: ${t.publishTime}\n${t.url ? `- **链接**: [查看原文](${t.url})\n` : ""}\n### 创作切入角度\n\n${t.angles.map((a, j) => `${j + 1}. ${a}`).join("\n")}\n`
    ).join("\n---\n\n");
  }, [favorites]);

  const buildCSV = useCallback(() => {
    const header = "标题,来源,热度,发布时间,链接,切入角度1,切入角度2,切入角度3\n";
    const rows = favorites.map((t) => {
      const angles = [...t.angles, "", "", ""].slice(0, 3);
      const escapeCSV = (s: string) => `"${s.replace(/"/g, '""')}"`;
      return [t.title, t.source, String(t.heatScore), t.publishTime, t.url, ...angles].map(escapeCSV).join(",");
    }).join("\n");
    return header + rows;
  }, [favorites]);

  const buildJSON = useCallback(() => {
    return JSON.stringify(favorites.map(({ id, title, source, url, snippet, heatScore, heatLevel, publishTime, angles }) => ({
      id, title, source, url, snippet, heatScore, heatLevel, publishTime, angles,
    })), null, 2);
  }, [favorites]);

  const handleExportMarkdown = useCallback(() => {
    downloadFile(buildMarkdown(), `灵感库_${new Date().toISOString().slice(0, 10)}.md`, "text/markdown");
    setShowExportMenu(false);
  }, [buildMarkdown]);

  const handleExportCSV = useCallback(() => {
    downloadFile(buildCSV(), `灵感库_${new Date().toISOString().slice(0, 10)}.csv`, "text/csv");
    setShowExportMenu(false);
  }, [buildCSV]);

  const handleExportJSON = useCallback(() => {
    downloadFile(buildJSON(), `灵感库_${new Date().toISOString().slice(0, 10)}.json`, "application/json");
    setShowExportMenu(false);
  }, [buildJSON]);

  if (!open) return null;

  const favKey = (t: TopicAngle) => t.url || t.id;

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
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" />
            </svg>
            <h2 className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
              我的灵感库 <span className={`font-normal ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>({favorites.length})</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* P1-5: Export dropdown */}
            {favorites.length > 0 && (
              <div className="relative">
                <button type="button" onClick={() => setShowExportMenu(!showExportMenu)} className={`text-xs transition-colors ${isDark ? "text-[#00D4FF]/70 hover:text-[#00D4FF]" : "text-[#00B4D8]/70 hover:text-[#00B4D8]"}`}>
                  导出收藏 ▾
                </button>
                {showExportMenu && (
                  <div className={`absolute right-0 top-full z-30 mt-1.5 w-32 overflow-hidden rounded-xl border shadow-2xl ${
                    isDark ? "border-[rgba(0,212,255,0.12)] bg-[#1A1F2E]" : "border-gray-200 bg-white"
                  }`}>
                    <button type="button" onClick={handleExportMarkdown} className={`flex w-full items-center px-3 py-2 text-left text-xs transition-colors ${isDark ? "text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "text-gray-600 hover:bg-gray-50"}`}>导出 Markdown</button>
                    <button type="button" onClick={handleExportCSV} className={`flex w-full items-center border-t px-3 py-2 text-left text-xs transition-colors ${isDark ? "border-[rgba(0,212,255,0.06)] text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "border-gray-100 text-gray-600 hover:bg-gray-50"}`}>导出 CSV</button>
                    <button type="button" onClick={handleExportJSON} className={`flex w-full items-center border-t px-3 py-2 text-left text-xs transition-colors ${isDark ? "border-[rgba(0,212,255,0.06)] text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "border-gray-100 text-gray-600 hover:bg-gray-50"}`}>导出 JSON</button>
                  </div>
                )}
              </div>
            )}
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
                <div key={favKey(topic)} className={`px-5 py-3.5 transition-colors ${isDark ? "hover:bg-[#252B3D]/30" : "hover:bg-gray-50"}`}>
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
                          copiedId === favKey(topic)
                            ? "text-[#00E5A0]"
                            : isDark
                              ? "text-[#8B92A8] hover:bg-[#252B3D] hover:text-[#00D4FF]"
                              : "text-gray-400 hover:bg-gray-100 hover:text-[#00B4D8]"
                        }`}
                        title="复制"
                      >
                        {copiedId === favKey(topic) ? (
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
                        onClick={() => onRemove(favKey(topic))}
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

        {/* P1-5: Local storage hint */}
        {favorites.length > 0 && (
          <div className={`border-t px-5 py-2.5 ${isDark ? "border-[rgba(0,212,255,0.06)]" : "border-gray-100"}`}>
            <p className={`text-center text-[11px] ${isDark ? "text-[#8B92A8]/40" : "text-gray-400"}`}>
              收藏数据存储在本地浏览器，清除浏览器数据将丢失
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
