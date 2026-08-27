"use client";

import type { TopicAngle } from "@/app/page";

interface ResultCardProps {
  topic: TopicAngle;
  index: number;
}

const heatLabels = {
  high: "高热",
  medium: "中热",
  low: "一般",
};

const heatColors = {
  high: "bg-red-50 text-red-600 border-red-100",
  medium: "bg-amber-50 text-amber-600 border-amber-100",
  low: "bg-stone-50 text-stone-500 border-stone-100",
};

const platformIcons: Record<string, string> = {
  "微博": "微",
  "知乎": "知",
  "抖音": "抖",
  "小红书": "红",
  "百度": "百",
  "B站": "B",
  "今日头条": "头",
  "微信公众号": "微",
  "36氪": "36",
  "虎嗅": "虎",
  "少数派": "少",
  "澎湃新闻": "澎",
  "界面新闻": "界",
};

export function ResultCard({ topic, index }: ResultCardProps) {
  const platformIcon = platformIcons[topic.source] || topic.source.charAt(0);

  return (
    <article className="group rounded-xl border border-[#E7E5E4] bg-white p-5 transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:-translate-y-px">
      {/* Header: rank + title + heat */}
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-stone-100 text-xs font-medium text-[#78716C]">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-snug text-[#1C1917]">
            {topic.url ? (
              <a
                href={topic.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-amber-600 transition-colors"
              >
                {topic.title}
                <svg
                  className="ml-1 inline h-3.5 w-3.5 text-[#A8A29E] group-hover:text-amber-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                  />
                </svg>
              </a>
            ) : (
              topic.title
            )}
          </h3>
          {topic.snippet && (
            <p className="mt-1.5 text-sm leading-relaxed text-[#78716C] line-clamp-2">
              {topic.snippet}
            </p>
          )}
        </div>
        {/* Heat indicator */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${heatColors[topic.heatLevel]}`}
          >
            {heatLabels[topic.heatLevel]}
          </span>
          <span className="text-xs text-[#A8A29E]">
            热度 {topic.heatScore}
          </span>
        </div>
      </div>

      {/* Meta: source + time */}
      <div className="mb-3 flex items-center gap-2 pl-9">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-stone-100 text-[10px] font-bold text-[#57534E]">
          {platformIcon}
        </span>
        <span className="text-xs text-[#78716C]">{topic.source}</span>
        <span className="text-[#D6D3D1]">|</span>
        <span className="text-xs text-[#A8A29E]">{topic.publishTime}</span>
      </div>

      {/* Content Angles */}
      <div className="ml-9 rounded-lg bg-[#FAFAF9] p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <svg
            className="h-3.5 w-3.5 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
            />
          </svg>
          <span className="text-xs font-medium text-[#57534E]">
            创作切入角度
          </span>
        </div>
        <ul className="space-y-1.5">
          {topic.angles.map((angle, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
              <span className="text-[#44403C] leading-relaxed">{angle}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
