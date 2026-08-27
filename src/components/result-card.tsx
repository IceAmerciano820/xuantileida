"use client";

import { useState, useCallback } from "react";
import type { TopicAngle } from "@/app/page";

interface ResultCardProps {
  topic: TopicAngle;
  index: number;
}

const heatLabels: Record<string, string> = {
  high: "高热",
  medium: "中热",
  low: "一般",
};

interface PlatformStyle {
  icon: string;
  color: string;
  bg: string;
}

const platformStyles: Record<string, PlatformStyle> = {
  "微博": { icon: "微", color: "#E6162D", bg: "rgba(230,22,45,0.12)" },
  "知乎": { icon: "知", color: "#0066FF", bg: "rgba(0,102,255,0.12)" },
  "抖音": { icon: "抖", color: "#00F0FF", bg: "rgba(0,240,255,0.1)" },
  "小红书": { icon: "红", color: "#FE2C55", bg: "rgba(254,44,85,0.12)" },
  "百度": { icon: "百", color: "#2932E1", bg: "rgba(41,50,225,0.12)" },
  "B站": { icon: "B", color: "#FB7299", bg: "rgba(251,114,153,0.12)" },
  "今日头条": { icon: "头", color: "#F85959", bg: "rgba(248,89,89,0.12)" },
  "微信公众号": { icon: "微", color: "#07C160", bg: "rgba(7,193,96,0.12)" },
  "36氪": { icon: "36", color: "#007FFF", bg: "rgba(0,127,255,0.12)" },
  "虎嗅": { icon: "虎", color: "#F05E22", bg: "rgba(240,94,34,0.12)" },
  "少数派": { icon: "少", color: "#DA635D", bg: "rgba(218,99,93,0.12)" },
  "澎湃新闻": { icon: "澎", color: "#C8102E", bg: "rgba(200,16,46,0.12)" },
  "界面新闻": { icon: "界", color: "#1A6EFF", bg: "rgba(26,110,255,0.12)" },
};

const defaultPlatform: PlatformStyle = { icon: "", color: "#00D4FF", bg: "rgba(0,212,255,0.1)" };

function formatPublishTime(raw: string): string {
  if (!raw || raw === "今日") return "今日";
  try {
    const date = new Date(raw);
    if (isNaN(date.getTime())) return raw;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return "刚刚";
    if (diffHours < 24) return `${diffHours}小时前`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}天前`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  } catch {
    return raw;
  }
}

function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition-all ${
        copied
          ? "text-[#00E5A0]"
          : "text-[#8B92A8] opacity-0 group-hover:opacity-100 hover:text-[#00D4FF]"
      } ${className || ""}`}
      title={`复制${label}`}
    >
      {copied ? (
        <>
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          <span>已复制</span>
        </>
      ) : (
        <>
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
          </svg>
          <span>复制</span>
        </>
      )}
    </button>
  );
}

export function ResultCard({ topic, index }: ResultCardProps) {
  const style = platformStyles[topic.source] || { ...defaultPlatform, icon: topic.source.charAt(0) };
  const formattedTime = formatPublishTime(topic.publishTime);

  const titleWithAngles = [
    `#${index + 1} ${topic.title}`,
    `来源: ${topic.source} | 热度: ${topic.heatScore}`,
    "",
    "创作切入角度:",
    ...topic.angles.map((a, i) => `  ${i + 1}. ${a}`),
  ].join("\n");

  return (
    <article className="group rounded-2xl border border-[rgba(0,212,255,0.1)] bg-[#1A1F2E]/70 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(0,212,255,0.3)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.3),0_0_20px_rgba(0,212,255,0.06)]">
      {/* Main content */}
      <div className="flex items-start gap-3 p-4 sm:p-5">
        {/* Rank number */}
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#252B3D] text-xs font-semibold text-[#8B92A8]">
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          {/* Title */}
          <h3 className="text-[15px] font-semibold leading-snug text-white">
            {topic.url ? (
              <a
                href={topic.url}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-[#00D4FF]"
              >
                {topic.title}
                <svg
                  className="ml-1 inline h-3.5 w-3.5 text-[#8B92A8]/50 transition-colors group-hover:text-[#00D4FF]/50"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            ) : (
              topic.title
            )}
          </h3>

          {/* Snippet */}
          {topic.snippet && (
            <p className="mt-1.5 text-sm leading-relaxed text-[#8B92A8] line-clamp-2">
              {topic.snippet}
            </p>
          )}

          {/* Meta row */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {/* Platform tag */}
            <span
              className="inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold"
              style={{ color: style.color, backgroundColor: style.bg }}
            >
              <span>{style.icon}</span>
              <span>{topic.source}</span>
            </span>
            {/* Time */}
            <span className="text-[11px] text-[#8B92A8]/70">{formattedTime}</span>
            {/* Copy title */}
            <CopyButton text={topic.title} label="标题" />
          </div>
        </div>

        {/* Heat indicator */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
            topic.heatLevel === "high"
              ? "bg-[rgba(255,77,106,0.12)] text-[#FF4D6A]"
              : topic.heatLevel === "medium"
              ? "bg-[rgba(0,212,255,0.1)] text-[#00D4FF]"
              : "bg-[#252B3D] text-[#8B92A8]"
          }`}>
            {heatLabels[topic.heatLevel]}
          </span>
          {/* Heat bar */}
          <div className="flex items-center gap-1.5">
            <div className="h-1 w-14 overflow-hidden rounded-full bg-[#252B3D]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#00D4FF]/60 to-[#00D4FF] transition-all duration-500"
                style={{ width: `${topic.heatScore}%` }}
              />
            </div>
            <span className="text-[11px] tabular-nums text-[#8B92A8]">{topic.heatScore}</span>
          </div>
        </div>
      </div>

      {/* Angles section */}
      <div className="border-t border-[rgba(0,212,255,0.06)] px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 text-[#00D4FF]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
            </svg>
            <span className="text-xs font-medium text-[#8B92A8]">创作切入角度</span>
          </div>
          <CopyButton text={titleWithAngles} label="全部" className="!opacity-100" />
        </div>
        <ul className="space-y-2">
          {topic.angles.map((angle, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#00D4FF]/70" />
              <span className="leading-relaxed text-white/80">{angle}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
