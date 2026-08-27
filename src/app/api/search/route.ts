import { NextRequest, NextResponse } from "next/server";
import {
  SearchClient,
  Config as SearchConfig,
  LLMClient,
  Config as LLMConfig,
  HeaderUtils,
} from "coze-coding-dev-sdk";

interface HotTopic {
  id: string;
  title: string;
  source: string;
  url: string;
  snippet: string;
  heatScore: number;
  heatLevel: "high" | "medium" | "low";
  publishTime: string;
  angles: string[];
  isPromotional?: boolean;
  matchedQueries?: string[];
}

interface TrendDataPoint {
  date: string;
  score: number;
}

/* ── P0-4: Snippet cleaning ── */

function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&#x27;": "'",
    "&nbsp;": " ",
    "&#160;": " ",
    "&hellip;": "…",
    "&mdash;": "—",
    "&ndash;": "–",
  };
  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replaceAll(entity, char);
  }
  result = result.replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 10)));
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 16)));
  return result;
}

const AD_PATTERNS = [
  /加微[信]?\s*[：:]?\s*[\w-]+/g,
  /微信号\s*[：:]?\s*[\w-]+/g,
  /加\s*QQ\s*[群号]?\s*[：:]?\s*[\w-]+/g,
  /扫码[下载关注]/g,
  /点击下载/g,
  /私信[领取获取]/g,
  /关注[公众号领取获取]/g,
  /免费领取/g,
  /限时免费/g,
  /长按识别/g,
  /回复\s*[\w]+\s*[领获]/g,
  /代购|淘宝店铺|闲鱼搜索/g,
  /咨询电话\s*[\d-]+/g,
  /商务合作\s*[：:]/g,
];

function cleanSnippet(raw: string): string {
  if (!raw) return "";
  let text = decodeHtmlEntities(raw);
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, "");
  // Remove ad patterns
  for (const pattern of AD_PATTERNS) {
    text = text.replace(pattern, "");
  }
  // Remove excessive whitespace
  text = text.replace(/[ \t]+/g, " ");
  // Remove repeated chars (4+ consecutive identical)
  text = text.replace(/(.)\1{4,}/g, "$1$1$1");
  // Remove \n\n+ -> \n
  text = text.replace(/\n{2,}/g, "\n");
  // Trim
  text = text.trim();
  // Truncate at sentence boundary (max 300 chars)
  if (text.length > 300) {
    const sub = text.substring(0, 300);
    const lastSentence = Math.max(
      sub.lastIndexOf("。"),
      sub.lastIndexOf("！"),
      sub.lastIndexOf("？"),
      sub.lastIndexOf("."),
      sub.lastIndexOf("!"),
      sub.lastIndexOf("?"),
      sub.lastIndexOf("\n"),
    );
    if (lastSentence > 100) {
      text = sub.substring(0, lastSentence + 1);
    } else {
      text = sub + "...";
    }
  }
  return text;
}

/* ── P0-1: Time range filtering ── */

function parsePublishTime(raw: string): Date | null {
  if (!raw || raw === "今日") return null;
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  } catch {
    /* ignore */
  }
  return null;
}

function isWithinTimeRange(publishTime: string, timeRange: string): boolean {
  const date = parsePublishTime(publishTime);
  if (!date) return true; // If can't parse, keep it
  const now = Date.now();
  const diffMs = now - date.getTime();
  const rangeMs: Record<string, number> = {
    "6h": 6 * 60 * 60 * 1000,
    "1d": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
  };
  const maxMs = rangeMs[timeRange] ?? rangeMs["1d"];
  return diffMs <= maxMs;
}

/* ── P1-7: Source blacklist + promotional detection ── */

const SOURCE_BLACKLIST = new Set([
  "4gamers.com.tw",
  "cocomy.net",
  "buzzjie.com",
  "kknews.cc",
  "read01.com",
  "ezvivi.com",
  "life.tw",
  "tvbs.com.tw",
  "ctwant.com",
  "mirrormedia.com.tw",
]);

function isBlacklisted(url: string): boolean {
  const lower = url.toLowerCase();
  return Array.from(SOURCE_BLACKLIST).some((d) => lower.includes(d));
}

const PROMO_SIGNALS = [
  "加微信", "加Q", "微信号", "扫码下载", "私信领取",
  "关注公众号领取", "免费领取", "限时免费", "长按识别",
  "点击下载", "代购", "淘宝搜索", "闲鱼搜索",
  "咨询热线", "商务合作", "投稿邮箱",
];

function detectPromotional(title: string, snippet: string): boolean {
  const text = (title + " " + snippet).toLowerCase();
  return PROMO_SIGNALS.some((sig) => text.includes(sig.toLowerCase()));
}

/* ── Platform detection ── */

function inferPlatform(siteName: string, url: string): string {
  const name = (siteName || "").toLowerCase();
  const link = (url || "").toLowerCase();

  if (name.includes("微博") || link.includes("weibo")) return "微博";
  if (name.includes("知乎") || link.includes("zhihu")) return "知乎";
  if (name.includes("抖音") || link.includes("douyin") || link.includes("tiktok")) return "抖音";
  if (name.includes("小红书") || link.includes("xiaohongshu")) return "小红书";
  if (name.includes("百度") || link.includes("baidu")) return "百度";
  if (name.includes("哔哩") || link.includes("bilibili")) return "B站";
  if (name.includes("头条") || link.includes("toutiao")) return "今日头条";
  if (name.includes("公众号") || link.includes("mp.weixin")) return "微信公众号";
  if (name.includes("36氪") || link.includes("36kr")) return "36氪";
  if (name.includes("虎嗅") || link.includes("huxiu")) return "虎嗅";
  if (name.includes("少数派") || link.includes("sspai")) return "少数派";
  if (name.includes("澎湃") || link.includes("thepaper")) return "澎湃新闻";
  if (name.includes("界面") || link.includes("jiemian")) return "界面新闻";
  if (name.includes("新浪") || link.includes("sina")) return "新浪";
  if (name.includes("网易") || link.includes("163")) return "网易";
  if (name.includes("腾讯") || link.includes("qq.com")) return "腾讯新闻";
  if (name.includes("IT之家") || link.includes("ithome")) return "IT之家";

  return siteName || "网络";
}

/* ── Heat score ── */

function computeHeatScore(rankScore: number | undefined, sortId: number): number {
  const base = rankScore ?? 50;
  const positionBonus = Math.max(0, 20 - sortId) * 3;
  return Math.min(99, Math.round(base * 0.6 + positionBonus + Math.random() * 10));
}

function getHeatLevel(score: number): "high" | "medium" | "low" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

/* ── P2-2: Trend data generation ── */

function generateTrendData(timeRange: string, items: Array<{ heatScore: number; publishTime: string }>): TrendDataPoint[] {
  const now = new Date();
  const points: TrendDataPoint[] = [];

  if (timeRange === "6h") {
    // Hourly granularity, 6 points
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      const label = `${d.getHours().toString().padStart(2, "0")}:00`;
      const hourItems = items.filter((item) => {
        const pt = parsePublishTime(item.publishTime);
        if (!pt) return false;
        const diffH = (now.getTime() - pt.getTime()) / (60 * 60 * 1000);
        return diffH >= i && diffH < i + 1;
      });
      const score = hourItems.length > 0
        ? Math.round(hourItems.reduce((s, it) => s + it.heatScore, 0) / hourItems.length)
        : Math.max(10, 30 - i * 3);
      points.push({ date: label, score });
    }
  } else if (timeRange === "1d") {
    // 4-hour granularity, 6 points
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 4 * 60 * 60 * 1000);
      const label = `${d.getHours().toString().padStart(2, "0")}:00`;
      const slotItems = items.filter((item) => {
        const pt = parsePublishTime(item.publishTime);
        if (!pt) return false;
        const diffH = (now.getTime() - pt.getTime()) / (60 * 60 * 1000);
        return diffH >= i * 4 && diffH < (i + 1) * 4;
      });
      const score = slotItems.length > 0
        ? Math.round(slotItems.reduce((s, it) => s + it.heatScore, 0) / slotItems.length)
        : Math.max(10, 35 - i * 4);
      points.push({ date: label, score });
    }
  } else {
    // Daily granularity, 7 points
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);
      const dayItems = items.filter((item) => {
        const pt = parsePublishTime(item.publishTime);
        if (!pt) return false;
        return pt >= dayStart && pt <= dayEnd;
      });
      const score = dayItems.length > 0
        ? Math.round(dayItems.reduce((s, it) => s + it.heatScore, 0) / dayItems.length)
        : Math.max(10, 40 + Math.sin(i * 1.2) * 20);
      points.push({ date: label, score: Math.round(score) });
    }
  }

  return points;
}

/* ── LLM angle generation (batched) ── */

const ANGLE_BATCH_SIZE = 15;

async function generateAnglesForBatch(
  keyword: string,
  topics: Array<{ title: string; snippet: string; source: string }>,
  llmClient: LLMClient
): Promise<string[][]> {
  const topicsDescription = topics
    .map(
      (t, i) =>
        `${i + 1}. [${t.source}] ${t.title}\n   摘要: ${t.snippet.substring(0, 120)}`
    )
    .join("\n");

  const prompt = `你是一位资深内容策划专家，擅长帮助内容创作者找到选题切入点。

当前用户搜索的关键词是：「${keyword}」

以下是搜索到的 ${topics.length} 条热点内容：

${topicsDescription}

请为每条热点内容提供 2-3 个具体的、可操作的内容切入角度建议。每个角度应该：
- 具体明确，不要泛泛而谈
- 告诉创作者可以从什么角度来创作内容（如：对比评测、个人经历分享、深度分析、实操教程、观点评论等）
- 考虑不同平台（短视频/图文/长文）的适配性

请严格按照以下 JSON 格式输出，不要输出其他内容：
[["角度1", "角度2", "角度3"], ["角度1", "角度2"], ...]

注意：数组中的每个子数组对应上面一条热点的切入角度，顺序必须一一对应。每个子数组包含 2-3 个字符串。`;

  try {
    const response = await llmClient.invoke(
      [
        {
          role: "system",
          content:
            "你是一位资深内容策划专家。请严格按照用户要求的 JSON 格式输出，不要输出任何其他内容。",
        },
        { role: "user", content: prompt },
      ],
      { model: "doubao-seed-2-0-mini-260215", temperature: 0.7 }
    );

    const content = response.content.trim();
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.map(
          (angles: unknown) =>
            Array.isArray(angles)
              ? angles.filter((a: unknown): a is string => typeof a === "string")
              : []
        );
      }
    }
  } catch (error) {
    console.error("LLM angle generation failed for batch:", error);
  }

  // Fallback for this batch
  return topics.map((t) => generateFallbackAngles(t.title, keyword));
}

function generateFallbackAngles(title: string, keyword: string): string[] {
  const angles: string[] = [];
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes("教程") || lowerTitle.includes("如何") || lowerTitle.includes("怎么")) {
    angles.push(`以「${keyword}新手指南」为主题，制作一篇保姆级实操教程`);
    angles.push(`拍摄一支「${keyword}避坑指南」短视频，分享常见误区`);
  } else if (lowerTitle.includes("排行") || lowerTitle.includes("推荐") || lowerTitle.includes("测评")) {
    angles.push(`做一期「${keyword}红黑榜」对比评测内容`);
    angles.push(`以个人体验为切入点，分享真实使用感受`);
  } else if (lowerTitle.includes("趋势") || lowerTitle.includes("未来") || lowerTitle.includes("预测")) {
    angles.push(`深度分析「${keyword}未来趋势」，结合数据做预判`);
    angles.push(`制作「行业现状」信息图/长图内容`);
  } else {
    angles.push(`围绕「${keyword}」制作一篇观点鲜明的评论文章`);
    angles.push(`以个人经历切入，分享引发共鸣的故事`);
    angles.push(`做一期「${keyword}入门到进阶」系列内容规划`);
  }
  return angles.slice(0, 3);
}

async function generateAngles(
  keyword: string,
  topics: Array<{ title: string; snippet: string; source: string }>
): Promise<string[][]> {
  const customHeaders: Record<string, string> = {};
  const llmConfig = new LLMConfig();
  const llmClient = new LLMClient(llmConfig, customHeaders);

  // Process in batches to avoid LLM timeout/quality degradation
  const allAngles: string[][] = [];
  for (let i = 0; i < topics.length; i += ANGLE_BATCH_SIZE) {
    const batch = topics.slice(i, i + ANGLE_BATCH_SIZE);
    const batchAngles = await generateAnglesForBatch(keyword, batch, llmClient);
    allAngles.push(...batchAngles);
  }
  return allAngles;
}

/* ── Main handler ── */

export async function POST(request: NextRequest) {
  try {
    const { keyword, timeRange, count } = await request.json();

    if (!keyword || typeof keyword !== "string" || keyword.trim().length === 0) {
      return NextResponse.json(
        { error: "请输入有效的关键词" },
        { status: 400 }
      );
    }

    const trimmedKeyword = keyword.trim();
    const validTimeRanges = ["6h", "1d", "7d"] as const;
    const resolvedTimeRange = validTimeRanges.includes(timeRange as typeof validTimeRanges[number])
      ? (timeRange as string)
      : "1d";
    const maxCount = Math.min(Math.max(count || 50, 1), 50);

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    const searchConfig = new SearchConfig();
    const searchClient = new SearchClient(searchConfig, customHeaders);

    // P0-1: Use time range as real query condition
    const searchQueries = [
      `${trimmedKeyword} 热点 热门话题 最新`,
      `${trimmedKeyword} 微博 知乎 讨论`,
      `${trimmedKeyword} 抖音 小红书 爆款`,
    ];

    const searchPromises = searchQueries.map((query, idx) =>
      searchClient.advancedSearch(query, {
        timeRange: resolvedTimeRange,
        count: 20,
        needSummary: false,
      }).catch((err: unknown) => {
        console.error(`Search failed for query ${idx}:`, err);
        return { web_items: [] };
      })
    );

    const results = await Promise.all(searchPromises);

    // P2-10: Dedup by URL, track matched queries
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    const allItems: Array<{
      title: string;
      source: string;
      url: string;
      snippet: string;
      heatScore: number;
      heatLevel: "high" | "medium" | "low";
      publishTime: string;
      isPromotional: boolean;
      matchedQueries: string[];
    }> = [];

    for (let qi = 0; qi < results.length; qi++) {
      const result = results[qi];
      if (!result.web_items) continue;

      for (const item of result.web_items) {
        const normalizedTitle = (item.title || "").trim();
        if (!normalizedTitle) continue;

        const itemUrl = item.url || "";
        const normalizedUrl = itemUrl.split("?")[0].split("#")[0]; // Strip query/hash for dedup

        // P2-10: Dedup by URL (primary) or title (fallback)
        const dedupKey = normalizedUrl || normalizedTitle;
        if (seenUrls.has(dedupKey) || seenTitles.has(normalizedTitle)) {
          // If already seen, add this query to matchedQueries
          const existing = allItems.find(
            (it) => (it.url.split("?")[0].split("#")[0] || it.title) === dedupKey
          );
          if (existing && !existing.matchedQueries.includes(searchQueries[qi])) {
            existing.matchedQueries.push(searchQueries[qi]);
          }
          continue;
        }

        // P0-4: Clean snippet
        const cleanedSnippet = cleanSnippet(item.snippet || "");

        // P0-1: Filter by keyword relevance
        const titleLower = normalizedTitle.toLowerCase();
        const snippetLower = cleanedSnippet.toLowerCase();
        const keywordLower = trimmedKeyword.toLowerCase();
        const isRelevant =
          titleLower.includes(keywordLower) ||
          snippetLower.includes(keywordLower) ||
          keywordLower.split("").some((char: string) => titleLower.includes(char));

        if (!isRelevant && keywordLower.length > 1) continue;

        // P1-7: Filter blacklisted sources
        if (isBlacklisted(itemUrl)) continue;

        // P0-1: Filter by time range
        const rawPublishTime = item.publish_time || "";
        if (rawPublishTime && !isWithinTimeRange(rawPublishTime, resolvedTimeRange)) continue;

        seenUrls.add(dedupKey);
        seenTitles.add(normalizedTitle);

        const platform = inferPlatform(item.site_name || "", itemUrl);
        const heatScore = computeHeatScore(item.rank_score, item.sort_id);
        // P1-7: Detect promotional content
        const isPromo = detectPromotional(normalizedTitle, cleanedSnippet);

        allItems.push({
          title: normalizedTitle,
          source: platform,
          url: itemUrl,
          snippet: cleanedSnippet,
          heatScore,
          heatLevel: getHeatLevel(heatScore),
          publishTime: rawPublishTime || "今日",
          isPromotional: isPromo,
          matchedQueries: [searchQueries[qi]],
        });
      }
    }

    // Sort by heat score
    allItems.sort((a, b) => b.heatScore - a.heatScore);

    // P1-2: Return up to maxCount results
    const topItems = allItems.slice(0, maxCount);

    if (topItems.length === 0) {
      const timeLabels: Record<string, string> = { "6h": "近6小时", "1d": "近24小时", "7d": "近7天" };
      const timeLabel = timeLabels[resolvedTimeRange] || "近24小时";
      return NextResponse.json({
        keyword: trimmedKeyword,
        topics: [],
        totalFound: 0,
        message: `暂未搜到「${trimmedKeyword}」在${timeLabel}内的相关热点，试试更换其他关键词或扩大时间范围`,
        trendData: generateTrendData(resolvedTimeRange, []),
      });
    }

    // Generate content angle suggestions using LLM
    const topicsForLLM = topItems.map((item) => ({
      title: item.title,
      snippet: item.snippet,
      source: item.source,
    }));

    const angles = await generateAngles(trimmedKeyword, topicsForLLM);

    const topics: HotTopic[] = topItems.map((item, index) => ({
      id: item.url || `topic-${index}`,
      title: item.title,
      source: item.source,
      url: item.url,
      snippet: item.snippet,
      heatScore: item.heatScore,
      heatLevel: item.heatLevel,
      publishTime: item.publishTime,
      angles: angles[index] || ["围绕该话题制作一篇深度分析内容", "以个人视角切入分享独特观点"],
      isPromotional: item.isPromotional,
      matchedQueries: item.matchedQueries.length > 1 ? item.matchedQueries : undefined,
    }));

    // P2-2: Generate trend data
    const trendData = generateTrendData(resolvedTimeRange, allItems);

    return NextResponse.json({
      keyword: trimmedKeyword,
      topics,
      totalFound: allItems.length,
      trendData,
    });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "搜索服务暂时不可用，请稍后重试" },
      { status: 500 }
    );
  }
}
