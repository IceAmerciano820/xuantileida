"use client";

import { useCallback, useState, useMemo } from "react";
import { useTheme } from "@/hooks/use-theme";
import type { TopicAngle, FavoriteStatus } from "@/app/page";

interface FavoritesModalProps {
  open: boolean;
  onClose: () => void;
  favorites: TopicAngle[];
  onRemove: (url: string) => void;
  onClear: () => void;
  onUpdateStatus: (key: string, status: FavoriteStatus) => void;
  onSchedule: (key: string, date: string | undefined) => void;
  onUpdateNote: (key: string, note: string) => void;
  onUpdateTags: (key: string, tags: string[]) => void;
  onImport: (items: TopicAngle[]) => void;
}

type ModalTab = "list" | "calendar";

const STATUS_CONFIG: Record<FavoriteStatus, { label: string; color: string; bg: string; dot: string }> = {
  draft: { label: "待构思", color: "#8B92A8", bg: "rgba(139,146,168,0.12)", dot: "#8B92A8" },
  scheduled: { label: "撰写中", color: "#FF6B35", bg: "rgba(255,107,53,0.12)", dot: "#FF6B35" },
  published: { label: "已发布", color: "#00E5A0", bg: "rgba(0,229,160,0.12)", dot: "#00E5A0" },
};

const STATUS_ORDER: FavoriteStatus[] = ["draft", "scheduled", "published"];

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

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Week calendar helpers ── */

function getWeekDates(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as first day
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  const week: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const wd = new Date(monday);
    wd.setDate(monday.getDate() + i);
    week.push(wd);
  }
  return week;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

function isToday(d: Date): boolean {
  const today = new Date();
  return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
}

const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export function FavoritesModal({ open, onClose, favorites, onRemove, onClear, onUpdateStatus, onSchedule, onUpdateNote, onUpdateTags, onImport }: FavoritesModalProps) {
  const { isDark } = useTheme();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalTab>("list");
  const [weekOffset, setWeekOffset] = useState(0);
  const [schedulingKey, setSchedulingKey] = useState<string | null>(null);
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [editingTagsKey, setEditingTagsKey] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const favKey = useCallback((t: TopicAngle) => t.url || t.id, []);

  // Ensure status defaults to draft
  const getStatus = useCallback((t: TopicAngle): FavoriteStatus => {
    return t.status || "draft";
  }, []);

  // Cycle status: draft → scheduled → published → draft
  const cycleStatus = useCallback((t: TopicAngle) => {
    const current = getStatus(t);
    const idx = STATUS_ORDER.indexOf(current);
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    onUpdateStatus(favKey(t), next);
  }, [getStatus, onUpdateStatus, favKey]);

  const handleCopy = useCallback(async (topic: TopicAngle) => {
    const text = [
      topic.title,
      `来源: ${topic.source} | 热度: ${topic.heatScore}`,
      topic.url ? `链接: ${topic.url}` : "",
      "",
      "创作切入角度:",
      ...topic.angles.map((a, i) => `  ${i + 1}. ${a}`),
    ].filter(Boolean).join("\n");
    await copyToClipboard(text);
    setCopiedId(favKey(topic));
    setTimeout(() => setCopiedId(null), 2000);
  }, [favKey]);

  // P1-5: Export favorites (Markdown/CSV/JSON)
  const buildMarkdown = useCallback(() => {
    return favorites.map((t, i) => {
      const status = getStatus(t);
      const statusLabel = STATUS_CONFIG[status].label;
      return `## ${i + 1}. ${t.title}\n\n- **来源**: ${t.source}\n- **热度**: ${t.heatScore}\n- **时间**: ${t.publishTime}\n- **状态**: ${statusLabel}${t.scheduledDate ? `\n- **排期**: ${t.scheduledDate}` : ""}\n${t.url ? `- **链接**: [查看原文](${t.url})\n` : ""}\n### 创作切入角度\n\n${t.angles.map((a, j) => `${j + 1}. ${a}`).join("\n")}\n`;
    }).join("\n---\n\n");
  }, [favorites, getStatus]);

  const buildCSV = useCallback(() => {
    const header = "标题,来源,热度,发布时间,状态,排期日期,链接,切入角度1,切入角度2,切入角度3\n";
    const rows = favorites.map((t) => {
      const angles = [...t.angles, "", "", ""].slice(0, 3);
      const escapeCSV = (s: string) => `"${s.replace(/"/g, '""')}"`;
      return [t.title, t.source, String(t.heatScore), t.publishTime, STATUS_CONFIG[getStatus(t)].label, t.scheduledDate || "", t.url, ...angles].map(escapeCSV).join(",");
    }).join("\n");
    return header + rows;
  }, [favorites, getStatus]);

  const buildJSON = useCallback(() => {
    return JSON.stringify(favorites.map(({ id, title, source, url, snippet, heatScore, heatLevel, publishTime, angles, status, scheduledDate, note, customTags, trendTag, score, scoreReason, relatedWords, riskLevel }) => ({
      id, title, source, url, snippet, heatScore, heatLevel, publishTime, angles,
      status: status || "draft", scheduledDate: scheduledDate || null,
      note: note || "", customTags: customTags || [],
      trendTag: trendTag || null, score: score || null, scoreReason: scoreReason || "",
      relatedWords: relatedWords || [], riskLevel: riskLevel || null,
    })), null, 2);
  }, [favorites]);

  const handleExportMarkdown = useCallback(() => {
    downloadFile(buildMarkdown(), `灵感库_${new Date().toISOString().slice(0, 10)}.md`, "text/markdown");
    setShowExportMenu(false);
  }, [buildMarkdown]);

  const handleExportCSV = useCallback(() => {
    downloadFile(buildCSV(), `灵感库_${new Date().toISOString().slice(0, 10)}.csv`, "text/csv");
    setShowExportMenu(false);
  }, [buildCSV]);

  const handleExportJSON = useCallback(() => {
    downloadFile(buildJSON(), `灵感库_${new Date().toISOString().slice(0, 10)}.json`, "application/json");
    setShowExportMenu(false);
  }, [buildJSON]);

  // P2-6: Export weekly plan
  const handleExportWeeklyPlan = useCallback(() => {
    const today = new Date();
    today.setDate(today.getDate() + weekOffset * 7);
    const weekDates = getWeekDates(today);
    const weekStart = formatDate(weekDates[0]);
    const weekEnd = formatDate(weekDates[6]);

    const lines: string[] = [
      `# 本周选题计划`,
      "",
      `> 排期周期: ${weekStart} ~ ${weekEnd}`,
      `> 生成时间: ${new Date().toLocaleString("zh-CN")}`,
      "",
    ];

    // Summary by status
    const stats = { draft: 0, scheduled: 0, published: 0 };
    favorites.forEach(f => { stats[getStatus(f)]++; });
    lines.push("## 概览");
    lines.push("");
    lines.push(`| 状态 | 数量 |`);
    lines.push(`|------|------|`);
    lines.push(`| 待构思 | ${stats.draft} |`);
    lines.push(`| 撰写中 | ${stats.scheduled} |`);
    lines.push(`| 已发布 | ${stats.published} |`);
    lines.push("");

    // Daily schedule
    lines.push("## 每日排期");
    lines.push("");

    weekDates.forEach((date, idx) => {
      const dateStr = formatDate(date);
      const dayItems = favorites.filter(f => f.scheduledDate === dateStr);
      lines.push(`### ${WEEKDAY_LABELS[idx]} (${dateStr})`);
      lines.push("");
      if (dayItems.length === 0) {
        lines.push("_暂无排期_");
        lines.push("");
      } else {
        dayItems.forEach((item, i) => {
          const status = getStatus(item);
          lines.push(`${i + 1}. **${item.title}**`);
          lines.push(`   - 关键词: ${item.source}`);
          lines.push(`   - 热度: ${item.heatScore}`);
          lines.push(`   - 状态: ${STATUS_CONFIG[status].label}`);
          lines.push(`   - 目标平台: ${item.source}`);
          lines.push(`   - 排期日期: ${dateStr}`);
          if (item.url) lines.push(`   - 原文链接: ${item.url}`);
          lines.push("");
        });
      }
    });

    // Unscheduled items
    const unscheduled = favorites.filter(f => !f.scheduledDate);
    if (unscheduled.length > 0) {
      lines.push("## 待排期");
      lines.push("");
      unscheduled.forEach((item, i) => {
        lines.push(`${i + 1}. **${item.title}** (热度: ${item.heatScore}, 状态: ${STATUS_CONFIG[getStatus(item)].label})`);
      });
      lines.push("");
    }

    downloadFile(lines.join("\n"), `本周选题计划_${weekStart}_${weekEnd}.md`, "text/markdown");
    setShowExportMenu(false);
  }, [favorites, getStatus, weekOffset]);

  // v2.1: Import JSON handler
  const handleImportJSON = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          if (!Array.isArray(data)) { setImportError("JSON 格式错误：需要是数组"); return; }
          const valid = data.filter((d: Record<string, unknown>) => d && typeof d.title === "string");
          if (valid.length === 0) { setImportError("未找到有效的选题数据"); return; }
          const items: TopicAngle[] = valid.map((d: Record<string, unknown>, i: number) => ({
            id: (d.id as string) || `import_${Date.now()}_${i}`,
            title: d.title as string,
            source: (d.source as string) || "导入",
            url: (d.url as string) || "",
            snippet: (d.snippet as string) || "",
            heatScore: (d.heatScore as number) || 0,
            heatLevel: (["high", "medium", "low"].includes(d.heatLevel as string) ? (d.heatLevel as "high" | "medium" | "low") : "medium") as TopicAngle["heatLevel"],
            publishTime: (d.publishTime as string) || new Date().toLocaleDateString("zh-CN"),
            angles: Array.isArray(d.angles) ? (d.angles as string[]) : [],
            trendTag: (["暴涨", "平稳", "降温", "潜力黑马"].includes(d.trendTag as string) ? (d.trendTag as TopicAngle["trendTag"]) : "平稳") as TopicAngle["trendTag"],
            score: (typeof d.score === "number" ? d.score : 0) as number,
            scoreReason: (typeof d.scoreReason === "string" ? d.scoreReason : "") as string,
            relatedWords: Array.isArray(d.relatedWords) ? (d.relatedWords as string[]) : [],
            riskLevel: (["低", "中", "高"].includes(d.riskLevel as string) ? (d.riskLevel as TopicAngle["riskLevel"]) : "低") as TopicAngle["riskLevel"],
            note: (d.note as string) || undefined,
            customTags: Array.isArray(d.customTags) ? (d.customTags as string[]) : [],
            status: ((["draft", "scheduled", "published"].includes(d.status as string) ? d.status : "draft") as FavoriteStatus),
            scheduledDate: (d.scheduledDate as string) || undefined,
            heatTrend: Array.isArray(d.heatTrend) ? (d.heatTrend as number[]) : [],
          }));
          onImport(items);
          setImportError(null);
        } catch {
          setImportError("JSON 解析失败，请检查文件格式");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [onImport]);

  // Note save
  const saveNote = useCallback((key: string) => {
    onUpdateNote(key, noteDraft.trim());
    setEditingNoteKey(null);
  }, [onUpdateNote, noteDraft]);

  // Tag add
  const addTag = useCallback((key: string, topic: TopicAngle) => {
    const tag = tagDraft.trim();
    if (!tag) return;
    const current = topic.customTags || [];
    if (current.includes(tag)) { setTagDraft(""); return; }
    onUpdateTags(key, [...current, tag]);
    setTagDraft("");
  }, [onUpdateTags, tagDraft]);

  // Tag remove
  const removeTag = useCallback((key: string, topic: TopicAngle, tag: string) => {
    const current = topic.customTags || [];
    onUpdateTags(key, current.filter(t => t !== tag));
  }, [onUpdateTags]);

  // Week calendar data
  const weekDates = useMemo(() => {
    const today = new Date();
    today.setDate(today.getDate() + weekOffset * 7);
    return getWeekDates(today);
  }, [weekOffset]);

  const weekStartStr = formatDate(weekDates[0]);
  const weekEndStr = formatDate(weekDates[6]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`absolute inset-0 ${isDark ? "bg-black/60" : "bg-black/40"} backdrop-blur-sm`} />
      <div className={`relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border shadow-2xl ${
        isDark ? "border-[rgba(0,212,255,0.15)] bg-[#1A1F2E]" : "border-gray-200 bg-white"
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between border-b px-5 py-3.5 ${
          isDark ? "border-[rgba(0,212,255,0.08)]" : "border-gray-100"
        }`}>
          <div className="flex items-center gap-2">
            <svg className={`h-4 w-4 ${isDark ? "text-[#00D4FF]" : "text-[#00B4D8]"}`} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" />
            </svg>
            <h2 className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
              我的灵感库 <span className={`font-normal ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>({favorites.length})</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {favorites.length > 0 && (
              <div className="relative">
                <button type="button" onClick={() => setShowExportMenu(!showExportMenu)} className={`text-xs transition-colors ${isDark ? "text-[#00D4FF]/70 hover:text-[#00D4FF]" : "text-[#00B4D8]/70 hover:text-[#00B4D8]"}`}>
                  导出 ▾
                </button>
                {showExportMenu && (
                  <div className={`absolute right-0 top-full z-30 mt-1.5 w-44 overflow-hidden rounded-xl border shadow-2xl ${
                    isDark ? "border-[rgba(0,212,255,0.12)] bg-[#1A1F2E]" : "border-gray-200 bg-white"
                  }`}>
                    <button type="button" onClick={handleExportWeeklyPlan} className={`flex w-full items-center px-3 py-2 text-left text-xs transition-colors ${isDark ? "text-[#00E5A0] hover:bg-[#252B3D]" : "text-emerald-600 hover:bg-gray-50"}`}>
                      <svg className="mr-2 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                      导出本周选题计划
                    </button>
                    <button type="button" onClick={handleExportMarkdown} className={`flex w-full items-center border-t px-3 py-2 text-left text-xs transition-colors ${isDark ? "border-[rgba(0,212,255,0.06)] text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "border-gray-100 text-gray-600 hover:bg-gray-50"}`}>导出 Markdown</button>
                    <button type="button" onClick={handleExportCSV} className={`flex w-full items-center border-t px-3 py-2 text-left text-xs transition-colors ${isDark ? "border-[rgba(0,212,255,0.06)] text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "border-gray-100 text-gray-600 hover:bg-gray-50"}`}>导出 CSV</button>
                    <button type="button" onClick={handleExportJSON} className={`flex w-full items-center border-t px-3 py-2 text-left text-xs transition-colors ${isDark ? "border-[rgba(0,212,255,0.06)] text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "border-gray-100 text-gray-600 hover:bg-gray-50"}`}>导出 JSON</button>
                  </div>
                )}
              </div>
            )}
            <button type="button" onClick={handleImportJSON} className={`text-xs transition-colors ${isDark ? "text-[#00E5A0]/70 hover:text-[#00E5A0]" : "text-emerald-500/70 hover:text-emerald-500"}`} title="从 JSON 文件导入">
              导入
            </button>
            {favorites.length > 0 && (
              <button type="button" onClick={onClear} className="text-xs text-[#FF4D6A]/70 hover:text-[#FF4D6A]">
                清空
              </button>
            )}
            <button type="button" onClick={onClose} className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
              isDark ? "text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "text-gray-400 hover:bg-gray-100"
            }`}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        {favorites.length > 0 && (
          <div className={`flex gap-1 border-b px-5 py-2 ${isDark ? "border-[rgba(0,212,255,0.08)]" : "border-gray-100"}`}>
            {([
              { value: "list" as const, label: "灵感列表" },
              { value: "calendar" as const, label: "排期日历" },
            ]).map((tab) => (
              <button key={tab.value} type="button" onClick={() => setActiveTab(tab.value)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === tab.value
                  ? (isDark ? "bg-[#00D4FF]/15 text-[#00D4FF]" : "bg-[#00B4D8]/10 text-[#00B4D8]")
                  : (isDark ? "text-[#8B92A8] hover:text-white" : "text-gray-500 hover:text-gray-700")
              }`}>{tab.label}</button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {favorites.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <svg className={`mb-3 h-10 w-10 ${isDark ? "text-[#8B92A8]/30" : "text-gray-300"}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.06.472 1.736 1.55 1.736 2.74v13.876c0 1.19-.676 2.268-1.736 2.74l-7.5 3.33a.75.75 0 0 1-.612 0l-7.5-3.33c-1.06-.472-1.736-1.55-1.736-2.74V6.062c0-1.19.676-2.268 1.736-2.74l7.5-3.33a.75.75 0 0 1 .612 0l7.5 3.33Z" />
              </svg>
              <p className={`text-sm ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>还没有收藏的灵感</p>
              <p className={`mt-1 text-xs ${isDark ? "text-[#8B92A8]/50" : "text-gray-400"}`}>点击热点卡片上的书签图标添加收藏</p>
            </div>
          ) : activeTab === "list" ? (
            /* ── List Tab ── */
            <div className="divide-y divide-[rgba(0,212,255,0.06)]">
              {favorites.map((topic) => {
                const status = getStatus(topic);
                const sc = STATUS_CONFIG[status];
                const key = favKey(topic);
                return (
                  <div key={key} className={`px-5 py-3.5 transition-colors ${isDark ? "hover:bg-[#252B3D]/30" : "hover:bg-gray-50"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h4 className={`text-sm font-medium leading-snug ${isDark ? "text-white" : "text-gray-900"}`}>
                          {topic.url ? (
                            <a href={topic.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#00D4FF] transition-colors">
                              {topic.title}
                            </a>
                          ) : topic.title}
                        </h4>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className={`text-xs ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>{topic.source}</span>
                          <span className={`text-xs ${isDark ? "text-[#8B92A8]/50" : "text-gray-400"}`}>·</span>
                          <span className="text-xs">🔥 {topic.heatScore}</span>
                          {topic.scheduledDate && (
                            <>
                              <span className={`text-xs ${isDark ? "text-[#8B92A8]/50" : "text-gray-400"}`}>·</span>
                              <span className={`text-xs ${isDark ? "text-[#FF6B35]/80" : "text-orange-500"}`}>📅 {topic.scheduledDate}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {/* P2-6: Status badge - click to cycle */}
                        <button
                          type="button"
                          onClick={() => cycleStatus(topic)}
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all active:scale-95"
                          style={{ backgroundColor: sc.bg, color: sc.color }}
                          title="点击切换状态"
                        >
                          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sc.dot }} />
                          {sc.label}
                        </button>
                        {/* Schedule date input */}
                        <button
                          type="button"
                          onClick={() => setSchedulingKey(schedulingKey === key ? null : key)}
                          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                            isDark ? "text-[#8B92A8] hover:bg-[#252B3D] hover:text-[#00D4FF]" : "text-gray-400 hover:bg-gray-100 hover:text-[#00B4D8]"
                          }`}
                          title="排期"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(topic)}
                          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                            copiedId === key
                              ? "text-[#00E5A0]"
                              : isDark ? "text-[#8B92A8] hover:bg-[#252B3D] hover:text-[#00D4FF]" : "text-gray-400 hover:bg-gray-100 hover:text-[#00B4D8]"
                          }`}
                          title="复制"
                        >
                          {copiedId === key ? (
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                          ) : (
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" /></svg>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(key)}
                          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                            isDark ? "text-[#8B92A8] hover:bg-[#FF4D6A]/10 hover:text-[#FF4D6A]" : "text-gray-400 hover:bg-red-50 hover:text-red-500"
                          }`}
                          title="取消收藏"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                    {/* Schedule date picker */}
                    {schedulingKey === key && (
                      <div className={`mt-2 flex items-center gap-2 rounded-lg border p-2 ${isDark ? "border-[rgba(0,212,255,0.08)] bg-[#12162A]/50" : "border-gray-100 bg-gray-50"}`}>
                        <span className={`text-xs ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>排期至:</span>
                        <input
                          type="date"
                          value={topic.scheduledDate || ""}
                          onChange={(e) => { onSchedule(key, e.target.value || undefined); }}
                          className={`rounded-lg border px-2 py-1 text-xs outline-none ${isDark ? "border-[rgba(0,212,255,0.1)] bg-[#0A0E1A] text-white" : "border-gray-200 bg-white text-gray-700"}`}
                        />
                        {topic.scheduledDate && (
                          <button type="button" onClick={() => { onSchedule(key, undefined); }} className="text-xs text-[#FF4D6A]/70 hover:text-[#FF4D6A]">清除</button>
                        )}
                      </div>
                    )}
                    {/* v2.1: Custom tags */}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {(topic.customTags || []).map((tag) => (
                        <span key={tag} className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] ${
                          isDark ? "bg-[#00D4FF]/10 text-[#00D4FF]/80" : "bg-[#00B4D8]/10 text-[#00B4D8]"
                        }`}>
                          {tag}
                          <button type="button" onClick={() => removeTag(key, topic, tag)} className="ml-0.5 opacity-50 hover:opacity-100">&times;</button>
                        </span>
                      ))}
                      {editingTagsKey === key ? (
                        <input
                          type="text"
                          value={tagDraft}
                          onChange={(e) => setTagDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { addTag(key, topic); } if (e.key === "Escape") { setEditingTagsKey(null); setTagDraft(""); } }}
                          onBlur={() => { if (tagDraft.trim()) addTag(key, topic); setEditingTagsKey(null); }}
                          placeholder="输入标签..."
                          autoFocus
                          className={`w-20 rounded-md border px-1.5 py-0.5 text-[11px] outline-none ${
                            isDark ? "border-[rgba(0,212,255,0.15)] bg-transparent text-white placeholder:text-[#8B92A8]/40" : "border-gray-200 bg-transparent text-gray-700 placeholder:text-gray-400"
                          }`}
                        />
                      ) : (
                        <button type="button" onClick={() => { setEditingTagsKey(key); setTagDraft(""); }} className={`rounded-full px-1.5 py-0.5 text-[11px] transition-colors ${
                          isDark ? "text-[#8B92A8]/50 hover:text-[#00D4FF]/70" : "text-gray-400 hover:text-[#00B4D8]"
                        }`}>+ 标签</button>
                      )}
                    </div>
                    {/* v2.1: Note */}
                    {editingNoteKey === key ? (
                      <div className="mt-2">
                        <textarea
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          placeholder="写下你的创作思路、素材备注..."
                          rows={2}
                          className={`w-full resize-none rounded-lg border p-2 text-xs outline-none ${
                            isDark ? "border-[rgba(0,212,255,0.1)] bg-[#12162A]/50 text-white placeholder:text-[#8B92A8]/40" : "border-gray-200 bg-gray-50 text-gray-700 placeholder:text-gray-400"
                          }`}
                          autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveNote(key); }}
                        />
                        <div className="mt-1 flex items-center gap-2">
                          <button type="button" onClick={() => saveNote(key)} className="rounded-md bg-[#00D4FF]/15 px-2 py-0.5 text-[11px] text-[#00D4FF] hover:bg-[#00D4FF]/25">保存</button>
                          <button type="button" onClick={() => { setEditingNoteKey(null); }} className={`text-[11px] ${isDark ? "text-[#8B92A8]" : "text-gray-500"}`}>取消</button>
                          <span className={`text-[10px] ${isDark ? "text-[#8B92A8]/40" : "text-gray-400"}`}>Ctrl+Enter 保存</span>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => { setEditingNoteKey(key); setNoteDraft(topic.note || ""); }} className={`mt-1.5 block w-full text-left text-[11px] italic transition-colors ${
                        topic.note
                          ? (isDark ? "text-[#8B92A8]/70 hover:text-white" : "text-gray-500 hover:text-gray-700")
                          : (isDark ? "text-[#8B92A8]/30 hover:text-[#8B92A8]/60" : "text-gray-400 hover:text-gray-500")
                      }`}>
                        {topic.note ? `📝 ${topic.note}` : "+ 添加笔记..."}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── Calendar Tab (P2-6) ── */
            <div className="p-4">
              {/* Week navigation */}
              <div className="mb-3 flex items-center justify-between">
                <button type="button" onClick={() => setWeekOffset(w => w - 1)} className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${isDark ? "text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "text-gray-400 hover:bg-gray-100"}`}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                </button>
                <span className={`text-xs font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                  {weekStartStr} ~ {weekEndStr}
                </span>
                <button type="button" onClick={() => setWeekOffset(w => w + 1)} className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${isDark ? "text-[#8B92A8] hover:bg-[#252B3D] hover:text-white" : "text-gray-400 hover:bg-gray-100"}`}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                </button>
              </div>

              {/* Week grid */}
              <div className="space-y-2">
                {weekDates.map((date, idx) => {
                  const dateStr = formatDate(date);
                  const dayItems = favorites.filter(f => f.scheduledDate === dateStr);
                  const today = isToday(date);
                  return (
                    <div key={dateStr} className={`rounded-xl border p-3 ${
                      today
                        ? (isDark ? "border-[#00D4FF]/30 bg-[#00D4FF]/[0.04]" : "border-[#00B4D8]/30 bg-blue-50/30")
                        : (isDark ? "border-[rgba(0,212,255,0.06)] bg-[#12162A]/30" : "border-gray-100 bg-gray-50/50")
                    }`}>
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className={`text-xs font-medium ${today ? (isDark ? "text-[#00D4FF]" : "text-[#00B4D8]") : (isDark ? "text-[#8B92A8]" : "text-gray-500")}`}>
                          {WEEKDAY_LABELS[idx]}
                        </span>
                        <span className={`text-xs ${isDark ? "text-[#8B92A8]/60" : "text-gray-400"}`}>
                          {dateStr}
                        </span>
                        {dayItems.length > 0 && (
                          <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium ${isDark ? "bg-[#00D4FF]/15 text-[#00D4FF]" : "bg-[#00B4D8]/10 text-[#00B4D8]"}`}>
                            {dayItems.length} 项
                          </span>
                        )}
                      </div>
                      {dayItems.length === 0 ? (
                        <p className={`text-xs ${isDark ? "text-[#8B92A8]/30" : "text-gray-300"}`}>暂无排期</p>
                      ) : (
                        <div className="space-y-1">
                          {dayItems.map((item) => {
                            const status = getStatus(item);
                            const sc = STATUS_CONFIG[status];
                            return (
                              <div key={favKey(item)} className="flex items-center gap-2">
                                <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: sc.dot }} />
                                <span className={`truncate text-xs ${isDark ? "text-white/80" : "text-gray-700"}`}>{item.title}</span>
                                <span className="ml-auto shrink-0 text-[10px]" style={{ color: sc.color }}>{sc.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Unscheduled count */}
              {(() => {
                const unscheduled = favorites.filter(f => !f.scheduledDate);
                return unscheduled.length > 0 ? (
                  <div className={`mt-3 rounded-xl border border-dashed p-3 text-center ${isDark ? "border-[rgba(0,212,255,0.1)]" : "border-gray-200"}`}>
                    <p className={`text-xs ${isDark ? "text-[#8B92A8]/60" : "text-gray-400"}`}>
                      还有 {unscheduled.length} 条灵感未排期，在「灵感列表」中点击日历图标安排日期
                    </p>
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>

        {/* Import error */}
        {importError && (
          <div className={`border-t px-5 py-2 ${isDark ? "border-[rgba(255,77,106,0.15)] bg-[#FF4D6A]/5" : "border-red-100 bg-red-50"}`}>
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#FF4D6A]">{importError}</p>
              <button type="button" onClick={() => setImportError(null)} className="text-xs text-[#FF4D6A]/50 hover:text-[#FF4D6A]">&times;</button>
            </div>
          </div>
        )}

        {/* Local storage hint */}
        {favorites.length > 0 && (
          <div className={`border-t px-5 py-2.5 ${isDark ? "border-[rgba(0,212,255,0.06)]" : "border-gray-100"}`}>
            <p className={`text-center text-[11px] ${isDark ? "text-[#8B92A8]/40" : "text-gray-400"}`}>
              收藏及排期数据存储在本地浏览器，清除浏览器数据将丢失
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
