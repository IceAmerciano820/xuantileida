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
}

function generateMockTrendData(keyword: string): TrendDataPoint[] {
  const seed = keyword.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const days: TrendDataPoint[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const base = 40 + (seed % 30);
    const variation = Math.sin(seed + i * 1.5) * 25 + Math.cos(seed * 0.7 + i) * 15;
    const score = Math.max(10, Math.min(100, Math.round(base + variation)));
    days.push({ date: `${month}/${day}`, score });
  }
  return days;
}

export function HeatTrendChart({ keyword, data }: HeatTrendChartProps) {
  const { isDark } = useTheme();

  const chartData = data.length > 0 ? data : generateMockTrendData(keyword);

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
          「{keyword}」近7天热度趋势
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
