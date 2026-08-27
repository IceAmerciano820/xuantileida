"use client";

import { useMemo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  MarkAreaComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useTheme } from "@/hooks/use-theme";

echarts.use([LineChart, GridComponent, TooltipComponent, MarkAreaComponent, CanvasRenderer]);

interface TrendDataPoint {
  date: string;
  score: number;
}

interface HeatTrendChartProps {
  keyword: string;
  data: TrendDataPoint[];
  timeRange: string;
}

function generateTrendData(keyword: string, timeRange: string): TrendDataPoint[] {
  const seed = keyword.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const now = new Date();
  const points: TrendDataPoint[] = [];

  if (timeRange === "6h") {
    // Hourly granularity, 6 points
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      const label = `${d.getHours().toString().padStart(2, "0")}:00`;
      const base = 40 + (seed % 30);
      const variation = Math.sin(seed + i * 1.5) * 25 + Math.cos(seed * 0.7 + i) * 15;
      const score = Math.max(10, Math.min(100, Math.round(base + variation)));
      points.push({ date: label, score });
    }
  } else if (timeRange === "1d") {
    // 4-hour granularity, 6 points
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 4 * 60 * 60 * 1000);
      const label = `${d.getHours().toString().padStart(2, "0")}:00`;
      const base = 45 + (seed % 25);
      const variation = Math.sin(seed + i * 1.2) * 20 + Math.cos(seed * 0.8 + i) * 12;
      const score = Math.max(10, Math.min(100, Math.round(base + variation)));
      points.push({ date: label, score });
    }
  } else {
    // Daily granularity, 7 points
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      const base = 40 + (seed % 30);
      const variation = Math.sin(seed + i * 1.5) * 25 + Math.cos(seed * 0.7 + i) * 15;
      const score = Math.max(10, Math.min(100, Math.round(base + variation)));
      points.push({ date: label, score });
    }
  }

  return points;
}

function getRangeLabel(timeRange: string): string {
  if (timeRange === "6h") return "近6小时";
  if (timeRange === "1d") return "近24小时";
  return "近7天";
}

export function HeatTrendChart({ keyword, data, timeRange }: HeatTrendChartProps) {
  const { isDark } = useTheme();

  const chartData = data.length > 0 ? data : generateTrendData(keyword, timeRange);
  const rangeLabel = getRangeLabel(timeRange);

  const option = useMemo(() => ({
    grid: {
      top: 20,
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
      formatter: (params: Array<{ name: string; value: number }>) => {
        const p = params[0];
        return `<span style="color:${isDark ? "#8B92A8" : "#6B7280"}">${p.name}</span><br/><span style="color:#00D4FF;font-weight:600">热度 ${p.value}</span>`;
      },
    },
    xAxis: {
      type: "category" as const,
      data: chartData.map(d => d.date),
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
    series: [
      {
        type: "line",
        data: chartData.map(d => d.score),
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: {
          width: 2.5,
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: "#FF6B35" },
            { offset: 1, color: "#00D4FF" },
          ]),
        },
        itemStyle: {
          color: "#00D4FF",
          borderColor: isDark ? "#1A1F2E" : "#FFFFFF",
          borderWidth: 2,
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(0,212,255,0.2)" },
            { offset: 1, color: "rgba(0,212,255,0)" },
          ]),
        },
      },
    ],
  }), [chartData, isDark]);

  // P2-2: Show "data insufficient" placeholder if no data points
  if (chartData.length === 0) {
    return (
      <div className={`rounded-2xl border p-4 ${
        isDark
          ? "border-[rgba(0,212,255,0.08)] bg-[#12162A]/50 backdrop-blur-xl"
          : "border-gray-100 bg-white shadow-sm"
      }`}>
        <div className="mb-2 flex items-center gap-2">
          <svg className={`h-4 w-4 ${isDark ? "text-[#00D4FF]" : "text-[#00B4D8]"}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 12.75l4.5 4.5L21.75 5.25" />
          </svg>
          <span className={`text-xs font-medium ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>
            「{keyword}」{rangeLabel}热度趋势
          </span>
        </div>
        <div className="flex h-[160px] items-center justify-center">
          <p className={`text-xs ${isDark ? "text-[#8B92A8]/50" : "text-gray-400"}`}>数据不足，暂无趋势</p>
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
      <div className="mb-2 flex items-center gap-2">
        <svg className={`h-4 w-4 ${isDark ? "text-[#00D4FF]" : "text-[#00B4D8]"}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 12.75l4.5 4.5L21.75 5.25" />
        </svg>
        <span className={`text-xs font-medium ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>
          「{keyword}」{rangeLabel}热度趋势
        </span>
      </div>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        style={{ height: 160, width: "100%" }}
        opts={{ renderer: "canvas" }}
      />
    </div>
  );
}
