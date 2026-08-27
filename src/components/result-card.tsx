"use client";

import { useState, useCallback } from "react";
import type { TopicAngle } from "@/app/page";

interface ResultCardProps {
  topic: TopicAngle;
  index: number;
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
  "少数派": { icon: "少", color: "#DA635D", bg: "rgba(218,99,93,0.15)" },
  "澎湃新闻": { icon: "澎", color: "#C8102E", bg: "rgba(200,16,46,0.15)" },
  "界面新闻": { icon: "界", color: "#1A6EFF", bg: "rgba(26,110,255,0.15)" },
};

const defaultPlatform: PlatformStyle = { icon: "", color: "#00D4FF", bg: "rgba(0,212,255,0.12)" };

function getHeatEmojis(level: string): string {
  switch (level) {
    case "high":
      return "🔥🔥🔥";
    case "medium":
      return "🔥🔥";
    case "low":
      return "🔥";
    default:
      return "🔥🔥";
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

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "h-3.5 w-3.5"} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "h-3.5 w-3.5"} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    resolve();
  });
}

function AngleCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

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
          : "text-[#8B92A8] opacity-0 group-hover:opacity-100 hover:text-[#00D4FF]"
      }`}
      title="复制此角度"
    >
      {copied ? (
        <>
          <CheckIcon className="h-3 w-3" />
          <span>已复制</span>
        </>
      ) : (
        <CopyIcon className="h-3 w-3" />
      )}
    </button>
  );
}

function CopyAllButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-all ${
        copied
          ? "text-[#00E5A0]"
          : "text-[#00D4FF]/70 hover:text-[#00D4FF] hover:bg-[#00D4FF]/5"
      }`}
      title={`复制${label}`}
    >
      {copied ? (
        <>
          <CheckIcon className="h-3 w-3" />
          <span>已复制</span>
        </>
      ) : (
        <>
          <CopyIcon className="h-3 w-3" />
          <span>复制全部</span>
        </>
      )}
    </button>
  );
}

export function ResultCard({ topic, index }: ResultCardProps) {
  const style = platformStyles[topic.source] || { ...defaultPlatform, icon: topic.source.charAt(0) };
  const formattedTime = formatPublishTime(topic.publishTime);
  const heatEmojis = getHeatEmojis(topic.heatLevel);

  const anglesText = topic.angles.map((a, i) => `${i + 1}. ${a}`).join("\n");
  const fullCopyText = [
    `#${index + 1} ${topic.title}`,
    `来源: ${topic.source} | 热度: ${topic.heatScore}`,
    topic.url ? `链接: ${topic.url}` : "",
    "",
    "创作切入角度:",
    anglesText,
  ].filter(Boolean).join("\n");

  return (
    <article className="group rounded-2xl border border-[rgba(0,212,255,0.1)] bg-[#1A1F2E]/70 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(0,212,255,0.3)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.3),0_0_20px_rgba(0,212,255,0.06)]">
      {/* Main content */}
      <div className="p-4 sm:p-5">
        {/* Title row */}
        <div className="flex items-start gap-3">
          {/* Rank number */}
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#252B3D] text-xs font-semibold text-[#8B92A8]">
            {index + 1}
          </span>

          <div className="min-w-0 flex-1">
            {/* Title - clickable link */}
            <h3 className="text-[15px] font-semibold leading-snug text-white break-words">
              {topic.url ? (
                <a
                  href={topic.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-[#00D4FF]"
                >
                  {topic.title}
                  <svg
                    className="ml-1 inline h-3.5 w-3.5 text-[#8B92A8]/40 transition-colors hover:text-[#00D4FF]/60"
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

            {/* Meta row: platform tag + heat emoji + time */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {/* Platform tag */}
              <span
                className="inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold"
                style={{ color: style.color, backgroundColor: style.bg }}
              >
                <span>{style.icon}</span>
                <span>{topic.source}</span>
              </span>
              {/* Heat emoji */}
              <span className="text-xs" title={`热度: ${topic.heatScore}`}>
                {heatEmojis}
              </span>
              {/* Time */}
              <span className="text-[11px] text-[#8B92A8]/70">{formattedTime}</span>
            </div>
          </div>
        </div>

        {/* Snippet */}
        {topic.snippet && (
          <p className="mt-3 text-sm leading-relaxed text-[#8B92A8]">
            {topic.snippet}
          </p>
        )}
      </div>

      {/* Angles section */}
      {topic.angles.length > 0 && (
        <div className="border-t border-[rgba(0,212,255,0.06)] px-4 py-3 sm:px-5">
          {/* Angles header */}
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[#00D4FF]/60">
              创作切入角度
            </span>
            <CopyAllButton text={fullCopyText} label="完整内容" />
          </div>

          {/* Angle items */}
          <ul className="space-y-1.5">
            {topic.angles.map((angle, i) => (
              <li key={i} className="group/angle flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00D4FF]/60" />
                <span className="flex-1 text-sm leading-relaxed text-white/85">
                  {angle}
                </span>
                <AngleCopyButton text={angle} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
