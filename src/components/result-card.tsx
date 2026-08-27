"use client";

import { useState, useCallback } from "react";
import type { TopicAngle } from "@/app/page";
import { useTheme } from "@/hooks/use-theme";
import { RadarPulseDot } from "@/components/radar-icon";

interface ResultCardProps {
  topic: TopicAngle;
  index: number;
  isFavorited: boolean;
  onToggleFavorite: (topic: TopicAngle) => void;
  onGenerate: (topic: TopicAngle) => void;
}

interface PlatformStyle {
  icon: string;
  color: string;
  bg: string;
}

const platformStyles: Record<string, PlatformStyle> = {
  "微博": { icon: "微", color: "#E6162D", bg: "rgba(230,22,45,0.15)" },
  "知乎": { icon: "知", color: "#0066FF", bg: "rgba(0,102,255,0.15)" },
  "抖音": { icon: "抖", color: "#00F0FF", bg: "rgba(0,240,255,0.12)" },
  "小红书": { icon: "红", color: "#FE2C55", bg: "rgba(254,44,85,0.15)" },
  "百度": { icon: "百", color: "#2932E1", bg: "rgba(41,50,225,0.15)" },
  "B站": { icon: "B", color: "#FB7299", bg: "rgba(251,114,153,0.15)" },
  "今日头条": { icon: "头", color: "#F85959", bg: "rgba(248,89,89,0.15)" },
  "微信公众号": { icon: "微", color: "#07C160", bg: "rgba(7,193,96,0.15)" },
  "36氪": { icon: "36", color: "#007FFF", bg: "rgba(0,127,255,0.15)" },
  "虎嗅": { icon: "虎", color: "#F05E22", bg: "rgba(240,94,34,0.15)" },
  "澎湃新闻": { icon: "澎", color: "#C8102E", bg: "rgba(200,16,46,0.15)" },
  "界面新闻": { icon: "界", color: "#1A6EFF", bg: "rgba(26,110,255,0.15)" },
};

const defaultPlatform: PlatformStyle = { icon: "", color: "#00D4FF", bg: "rgba(0,212,255,0.12)" };

function getHeatEmojis(level: string): string {
  switch (level) {
    case "high": return "🔥🔥🔥";
    case "medium": return "🔥🔥";
    case "low": return "🔥";
    default: return "🔥🔥";
  }
}

function formatPublishTime(raw: string): string {
  if (!raw || raw === "今日") return "今日";
  try {
    const date = new Date(raw);
    if (isNaN(date.getTime())) return raw;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 1) return "刚刚";
    if (diffMinutes < 60) return `${diffMinutes}分钟前`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}小时前`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}天前`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  } catch {
    return raw;
  }
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

function AngleCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { isDark } = useTheme();

  const handleCopy = useCallback(async () => {
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition-all ${
        copied
          ? "text-[#00E5A0]"
          : `opacity-0 group-hover:opacity-100 ${isDark ? "text-[#8B92A8] hover:text-[#00D4FF]" : "text-gray-400 hover:text-[#00B4D8]"}`
      }`}
      title="复制此角度"
    >
      {copied ? (
        <>
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
          <span>已复制</span>
        </>
      ) : (
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" /></svg>
      )}
    </button>
  );
}

export function ResultCard({ topic, index, isFavorited, onToggleFavorite, onGenerate }: ResultCardProps) {
  const style = platformStyles[topic.source] || { ...defaultPlatform, icon: topic.source.charAt(0) };
  const formattedTime = formatPublishTime(topic.publishTime);
  const heatEmojis = getHeatEmojis(topic.heatLevel);
  const { isDark } = useTheme();

  const anglesText = topic.angles.map((a, i) => `${i + 1}. ${a}`).join("\n");
  const fullCopyText = [
    `#${index + 1} ${topic.title}`,
    `来源: ${topic.source} | 热度: ${topic.heatScore}`,
    topic.url ? `链接: ${topic.url}` : "",
    "",
    "创作切入角度:",
    anglesText,
  ].filter(Boolean).join("\n");

  const [allCopied, setAllCopied] = useState(false);
  const handleCopyAll = useCallback(async () => {
    await copyToClipboard(fullCopyText);
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
  }, [fullCopyText]);

  return (
    <article className={`group rounded-2xl border backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 ${
      isDark
        ? "border-[rgba(0,212,255,0.1)] bg-[#1A1F2E]/70 hover:border-[rgba(0,212,255,0.3)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.3),0_0_20px_rgba(0,212,255,0.06)]"
        : "border-gray-200 bg-white shadow-sm hover:border-[#00B4D8]/30 hover:shadow-[0_4px_24px_rgba(0,0,0,0.08),0_0_12px_rgba(0,180,216,0.06)]"
    }`}>
      <div className="p-4 sm:p-5">
        {/* Title row */}
        <div className="flex items-start gap-3">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
            isDark ? "bg-[#252B3D] text-[#8B92A8]" : "bg-gray-100 text-gray-500"
          }`}>
            {index + 1}
          </span>

          <div className="min-w-0 flex-1">
            <h3 className={`text-[15px] font-semibold leading-snug break-words ${isDark ? "text-white" : "text-gray-900"}`}>
              {topic.url ? (
                <a href={topic.url} target="_blank" rel="noopener noreferrer" className={`inline transition-colors ${isDark ? "hover:text-[#00D4FF]" : "hover:text-[#00B4D8]"}`}>
                  {topic.title}
                  <svg className="ml-1 inline h-3 w-3 opacity-40" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                </a>
              ) : topic.title}
            </h3>

            {/* Meta row */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ color: style.color, backgroundColor: style.bg }}>
                {style.icon} {topic.source}
              </span>
              <span className="inline-flex items-center gap-1 text-xs" title={`热度指数: ${topic.heatScore}`}>
                <RadarPulseDot color={isDark ? "#00D4FF" : "#00B4D8"} className="h-1.5 w-1.5" />
                {heatEmojis}
              </span>
              <span className={`text-xs ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>{formattedTime}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleFavorite(topic)}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                isFavorited
                  ? "text-[#00D4FF]"
                  : isDark
                    ? "text-[#8B92A8]/40 opacity-0 hover:text-[#00D4FF] group-hover:opacity-100"
                    : "text-gray-300 opacity-0 hover:text-[#00B4D8] group-hover:opacity-100"
              }`}
              title={isFavorited ? "取消收藏" : "收藏"}
            >
              <svg className="h-4 w-4" fill={isFavorited ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={isFavorited ? 0 : 1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.06.472 1.736 1.55 1.736 2.74v13.876c0 1.19-.676 2.268-1.736 2.74l-7.5 3.33a.75.75 0 0 1-.612 0l-7.5-3.33c-1.06-.472-1.736-1.55-1.736-2.74V6.062c0-1.19.676-2.268 1.736-2.74l7.5-3.33a.75.75 0 0 1 .612 0l7.5 3.33Z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Snippet */}
        {topic.snippet && (
          <p className={`mt-3 text-sm leading-relaxed line-clamp-2 ${isDark ? "text-[#8B92A8]/80" : "text-gray-600"}`}>
            {topic.snippet}
          </p>
        )}

        {/* Angles section */}
        {topic.angles.length > 0 && (
          <div className={`mt-4 border-t pt-3 ${isDark ? "border-[rgba(0,212,255,0.06)]" : "border-gray-100"}`}>
            <div className="mb-2 flex items-center justify-between">
              <span className={`text-xs font-medium ${isDark ? "text-[#8B92A8]/60" : "text-gray-400"}`}>创作切入角度</span>
              <button
                type="button"
                onClick={handleCopyAll}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-all ${
                  allCopied
                    ? "text-[#00E5A0]"
                    : isDark
                      ? "text-[#00D4FF]/70 hover:bg-[#00D4FF]/5 hover:text-[#00D4FF]"
                      : "text-[#00B4D8]/70 hover:bg-blue-50 hover:text-[#00B4D8]"
                }`}
              >
                {allCopied ? (
                  <>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                    <span>已复制</span>
                  </>
                ) : (
                  <>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" /></svg>
                    <span>复制全部</span>
                  </>
                )}
              </button>
            </div>
            <div className="space-y-1.5">
              {topic.angles.map((angle, i) => (
                <div key={i} className="group/angle flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00D4FF]" />
                  <span className={`text-sm leading-relaxed ${isDark ? "text-white/80" : "text-gray-700"}`}>{angle}</span>
                  <AngleCopyButton text={angle} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Generate content button */}
        <div className={`mt-3 flex justify-end border-t pt-3 ${isDark ? "border-[rgba(0,212,255,0.06)]" : "border-gray-100"}`}>
          <button
            type="button"
            onClick={() => onGenerate(topic)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all hover:scale-[1.02] ${
              isDark
                ? "border-[#00D4FF]/30 text-[#00D4FF] hover:border-[#00D4FF]/50 hover:bg-[#00D4FF]/5 hover:shadow-[0_0_12px_rgba(0,212,255,0.15)]"
                : "border-[#00B4D8]/30 text-[#00B4D8] hover:border-[#00B4D8]/50 hover:bg-blue-50"
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
            </svg>
            生成内容
          </button>
        </div>
      </div>
    </article>
  );
}
