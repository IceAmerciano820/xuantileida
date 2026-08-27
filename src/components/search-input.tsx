"use client";

import { useState, type FormEvent } from "react";

interface SearchInputProps {
  loading: boolean;
}

export function SearchInput({ loading }: SearchInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!value.trim() || loading) return;
    const form = e.currentTarget;
    const submitEvent = new SubmitEvent("submit", { cancelable: true });
    form.dispatchEvent(submitEvent);
  };

  return (
    <div className="flex gap-3">
      <div className="relative flex-1">
        <svg
          className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#A8A29E]"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
        <input
          name="keyword"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="输入关键词，如：搞钱、副业、AI工具..."
          disabled={loading}
          className="h-11 w-full rounded-xl border border-[#E7E5E4] bg-white pl-10 pr-4 text-sm text-[#1C1917] placeholder:text-[#A8A29E] outline-none transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
        />
      </div>
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-500 px-5 text-sm font-medium text-white transition-all hover:bg-amber-600 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>采集中...</span>
          </>
        ) : (
          <>
            <svg
              className="h-4 w-4"
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
            </svg>
            <span>采集热点</span>
          </>
        )}
      </button>
    </div>
  );
}
