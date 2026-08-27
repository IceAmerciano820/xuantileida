"use client";

import { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useTheme } from "@/hooks/use-theme";

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

export interface KeywordTrend {
  keyword: string;
  data: Array<{ date: string; score: number }>;
}

interface TrendCompareChartProps {
  trends: KeywordTrend[];
  conclusion: string;
  xLabels: string[];
  timeRange: string;
  loading?: boolean;
  onRemoveKeyword?: (keyword: string) => void;
}

const LINE_COLORS = ["#00D4FF", "#FF6B35", "#00E5A0"];

function getRangeLabel(timeRange: string): string {
  if (timeRange === "6h") return "近6小时";
  if (timeRange === "1d") return "近24小时";
  return "近7天";
}

export function TrendCompareChart({ trends, conclusion, xLabels, timeRange, loading, onRemoveKeyword }: TrendCompareChartProps) {
  const { isDark } = useTheme();
  const rangeLabel = getRangeLabel(timeRange);

  const option = useMemo(() => ({
    grid: {
      top: 36,
      right: 16,
      bottom: 28,
      left: 40,
    },
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: isDark ? "#1A1F2E" : "#FFFFFF",
      borderColor: isDark ? "rgba(0,212,255,0.15)" : "#E5E7EB",
      textStyle: {
        color: isDark ? "#FFFFFF" : "#1A1A2E",
        fontSize: 12,
      },
      formatter: (params: Array<{ seriesName: string; value: number; color: string }>) => {
        const header = params[0] ? `<span style="color:${isDark ? "#8B92A8" : "#6B7280"};font-size:11px">${(params[0] as { name?: string }).name || ""}</span>` : "";
        const lines = params.map((p) =>
          `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px;"></span>${p.seriesName}: <b style="color:${p.color}">${p.value}</b>`
        );
        return [header, ...lines].join("<br/>");
      },
    },
    legend: {
      data: trends.map(t => t.keyword),
      top: 4,
      right: 8,
      textStyle: {
        color: isDark ? "#8B92A8" : "#6B7280",
        fontSize: 11,
      },
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 12,
    },
    xAxis: {
      type: "category" as const,
      data: xLabels,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: isDark ? "#8B92A8" : "#9CA3AF",
        fontSize: 11,
      },
    },
    yAxis: {
      type: "value" as const,
      min: 0,
      max: 100,
      splitNumber: 3,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: isDark ? "#8B92A8" : "#9CA3AF",
        fontSize: 11,
      },
      splitLine: {
        lineStyle: {
          color: isDark ? "rgba(139,146,168,0.08)" : "rgba(0,0,0,0.05)",
        },
      },
    },
    series: trends.map((trend, idx) => ({
      name: trend.keyword,
      type: "line" as const,
      data: trend.data.map(d => d.score),
      smooth: true,
      symbol: "circle",
      symbolSize: 5,
      lineStyle: {
        width: 2.5,
        color: LINE_COLORS[idx % LINE_COLORS.length],
      },
      itemStyle: {
        color: LINE_COLORS[idx % LINE_COLORS.length],
        borderColor: isDark ? "#1A1F2E" : "#FFFFFF",
        borderWidth: 2,
      },
      areaStyle: idx === 0 ? {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: "rgba(0,212,255,0.12)" },
          { offset: 1, color: "rgba(0,212,255,0)" },
        ]),
      } : undefined,
    })),
  }), [trends, xLabels, isDark]);

  if (loading) {
    return (
      <div className={`rounded-2xl border p-4 ${
        isDark
          ? "border-[rgba(0,212,255,0.08)] bg-[#12162A]/50 backdrop-blur-xl"
          : "border-gray-100 bg-white shadow-sm"
      }`}>
        <div className="mb-2 flex items-center gap-2">
          <svg className="h-4 w-4 animate-spin text-[#00D4FF]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className={`text-xs font-medium ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>
            正在对比关键词趋势...
          </span>
        </div>
        <div className="flex h-[160px] items-center justify-center">
          <div className="h-full w-full animate-pulse rounded-lg bg-[#8B92A8]/5" />
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-4 ${
      isDark
        ? "border-[rgba(0,212,255,0.08)] bg-[#12162A]/50 backdrop-blur-xl"
        : "border-gray-100 bg-white shadow-sm"
    }`}>
      {/* Header with keyword tags */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <svg className={`h-4 w-4 ${isDark ? "text-[#00D4FF]" : "text-[#00B4D8]"}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
        <span className={`text-xs font-medium ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>
          多关键词对比 · {rangeLabel}
        </span>
        {/* Keyword tags with remove buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {trends.map((trend, idx) => (
            <span
              key={trend.keyword}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: `${LINE_COLORS[idx % LINE_COLORS.length]}15`,
                color: LINE_COLORS[idx % LINE_COLORS.length],
              }}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: LINE_COLORS[idx % LINE_COLORS.length] }} />
              {trend.keyword}
              {onRemoveKeyword && (
                <button
                  type="button"
                  onClick={() => onRemoveKeyword(trend.keyword)}
                  className="ml-0.5 transition-opacity hover:opacity-70"
                  title="移除对比"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        style={{ height: 200, width: "100%" }}
        opts={{ renderer: "canvas" }}
      />

      {/* Conclusion */}
      {conclusion && (
        <div className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 ${
          isDark
            ? "border-[rgba(0,212,255,0.1)] bg-[#00D4FF]/[0.04]"
            : "border-blue-100 bg-blue-50/50"
        }`}>
          <svg className={`mt-0.5 h-4 w-4 shrink-0 ${isDark ? "text-[#00D4FF]" : "text-[#00B4D8]"}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.123m-1.5.123a6.01 6.01 0 0 1-1.5-.123m1.5.123a6.01 6.01 0 0 1 1.5-.123M12 18a6 6 0 0 0 4.5-9.75M12 18a6 6 0 0 1-4.5-9.75m9.75 0a6 6 0 0 0-1.5-.123M12 6.75a6 6 0 0 1 9 4.5m-9-4.5a6 6 0 0 0-9 4.5m9 0a6 6 0 0 0-1.5-.123M12 12.75a6 6 0 0 0-1.5-.123m1.5.123a6 6 0 0 1-1.5-.123" />
          </svg>
          <p className={`text-xs leading-relaxed ${isDark ? "text-[#8B92A8]" : "text-gray-600"}`}>
            {conclusion}
          </p>
        </div>
      )}
    </div>
  );
}
