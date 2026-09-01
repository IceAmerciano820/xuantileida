"use client";

import { useRef, useEffect } from "react";
import { useTheme } from "@/hooks/use-theme";
import { RadarScanAnimation, RadarIcon } from "@/components/radar-icon";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
}

export function SearchInput({ value, onChange, onSubmit, loading, error }: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); onSubmit(); }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <svg className={`pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${isDark ? "text-[#64748B]" : "text-[#94A3B8]"}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入关键词，如：搞钱、副业、AI工具..."
            disabled={loading}
            className={`h-11 w-full rounded-[10px] border pl-10 pr-4 text-sm outline-none transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 search-input-glow ${
              isDark
                ? "border-[rgba(148,163,184,0.1)] bg-[rgba(22,27,45,0.6)] text-[#F1F5F9] placeholder:text-[#64748B] focus:border-[#00C6ED]/40"
                : "border-[rgba(0,0,0,0.08)] bg-white text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#00B4D8]/40"
            }`}
          />
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[10px] px-5 text-sm font-semibold transition-all duration-200 hover:-translate-y-px active:scale-[0.97] disabled:cursor-not-allowed disabled:translate-y-0 disabled:scale-100 ${
            loading
              ? "bg-[#00C6ED]/30 text-white/50 shadow-none"
              : "btn-cta"
          }`}
        >
          {loading ? (
            <>
              <RadarScanAnimation size={18} className="text-white" />
              <span>雷达扫描中...</span>
            </>
          ) : (
            <>
              <RadarIcon size={18} className="shrink-0" />
              <span>采集热点</span>
            </>
          )}
        </button>
      </div>
      {error && <p className="text-xs text-[#F43F5E]">{error}</p>}
    </div>
  );
}
