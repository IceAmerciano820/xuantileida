"use client";

import { useState, useCallback } from "react";
import { useTheme } from "@/hooks/use-theme";

interface MonitorKeywordsModalProps {
  open: boolean;
  onClose: () => void;
  keywords: string[];
  onSave: (keywords: string[]) => void;
}

const MAX_KEYWORDS = 5;
const DEFAULT_KEYWORDS = ["AI工具", "副业", "科技"];

export function MonitorKeywordsModal({ open, onClose, keywords, onSave }: MonitorKeywordsModalProps) {
  const { isDark } = useTheme();
  const [draft, setDraft] = useState<string[]>(keywords.length > 0 ? keywords : DEFAULT_KEYWORDS);
  const [input, setInput] = useState("");

  const handleAdd = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (draft.length >= MAX_KEYWORDS) return;
    if (draft.includes(trimmed)) return;
    setDraft(prev => [...prev, trimmed]);
    setInput("");
  }, [input, draft]);

  const handleRemove = useCallback((kw: string) => {
    setDraft(prev => prev.filter(k => k !== kw));
  }, []);

  const handleSave = useCallback(() => {
    onSave(draft.length > 0 ? draft : DEFAULT_KEYWORDS);
    onClose();
  }, [draft, onSave, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }, [handleAdd]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`absolute inset-0 ${isDark ? "bg-black/60" : "bg-black/40"} backdrop-blur-sm`} />
      <div className={`relative w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl ${
        isDark ? "border-[rgba(148,163,184,0.1)] bg-[#0F172A]/95" : "border-[rgba(0,0,0,0.06)] bg-white/98"
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between border-b px-5 py-3.5 ${
          isDark ? "border-[rgba(148,163,184,0.08)]" : "border-[rgba(0,0,0,0.06)]"
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-base">📡</span>
            <h2 className={`text-sm font-semibold ${isDark ? "text-[#F1F5F9]" : "text-[#0F172A]"}`}>
              我的监控关键词
            </h2>
          </div>
          <button type="button" onClick={onClose} className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
            isDark ? "text-[#64748B] hover:bg-[rgba(148,163,184,0.08)] hover:text-[#F1F5F9]" : "text-[#94A3B8] hover:bg-gray-100"
          }`}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <p className={`text-xs leading-relaxed ${isDark ? "text-[#64748B]" : "text-[#94A3B8]"}`}>
            设置常驻监控关键词，每天首次打开自动扫描生成选题简报。最多 {MAX_KEYWORDS} 个。
          </p>

          {/* Current keywords */}
          <div className="flex flex-wrap gap-2">
            {draft.map((kw) => (
              <span
                key={kw}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                  isDark ? "bg-[rgba(0,198,237,0.1)] text-[#00C6ED]" : "bg-[rgba(0,180,216,0.08)] text-[#00B4D8]"
                }`}
              >
                {kw}
                <button
                  type="button"
                  onClick={() => handleRemove(kw)}
                  className={`ml-0.5 rounded-full transition-colors ${
                    isDark ? "hover:bg-[rgba(0,198,237,0.2)]" : "hover:bg-[rgba(0,180,216,0.15)]"
                  }`}
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
            {draft.length === 0 && (
              <span className={`text-xs ${isDark ? "text-[#475569]" : "text-[#CBD5E1]"}`}>
                暂无关键词，请添加
              </span>
            )}
          </div>

          {/* Add input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入关键词，回车添加"
              maxLength={20}
              disabled={draft.length >= MAX_KEYWORDS}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm outline-none transition-all ${
                isDark
                  ? "border-[rgba(148,163,184,0.1)] bg-[rgba(15,23,42,0.6)] text-[#F1F5F9] placeholder:text-[#475569] focus:border-[#00C6ED]/30"
                  : "border-[rgba(0,0,0,0.08)] bg-white text-[#0F172A] placeholder:text-[#CBD5E1] focus:border-[#00B4D8]/30"
              } disabled:opacity-50`}
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!input.trim() || draft.length >= MAX_KEYWORDS}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-all disabled:opacity-40 ${
                isDark
                  ? "bg-[#00C6ED]/10 text-[#00C6ED] hover:bg-[#00C6ED]/20"
                  : "bg-[#00B4D8]/10 text-[#00B4D8] hover:bg-[#00B4D8]/20"
              }`}
            >
              添加
            </button>
          </div>

          {draft.length >= MAX_KEYWORDS && (
            <p className={`text-xs ${isDark ? "text-[#F59E0B]" : "text-[#D97706]"}`}>
              已达上限（{MAX_KEYWORDS} 个），删除后可继续添加
            </p>
          )}
        </div>

        {/* Footer */}
        <div className={`flex justify-end gap-2 border-t px-5 py-3 ${
          isDark ? "border-[rgba(148,163,184,0.08)]" : "border-[rgba(0,0,0,0.06)]"
        }`}>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg px-4 py-2 text-xs font-medium transition-all ${
              isDark ? "text-[#94A3B8] hover:bg-[rgba(148,163,184,0.08)]" : "text-[#64748B] hover:bg-gray-100"
            }`}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={`rounded-lg px-4 py-2 text-xs font-medium transition-all ${
              isDark
                ? "bg-[#00C6ED] text-[#0B0F1A] hover:shadow-[0_0_12px_rgba(0,198,237,0.3)]"
                : "bg-[#00B4D8] text-white hover:shadow-[0_0_12px_rgba(0,180,216,0.3)]"
            }`}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
