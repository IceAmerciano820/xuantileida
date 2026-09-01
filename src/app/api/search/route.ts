import { NextRequest, NextResponse } from "next/server";
import {
  SearchClient,
  Config as SearchConfig,
  LLMClient,
  Config as LLMConfig,
  HeaderUtils,
} from "coze-coding-dev-sdk";

/* ── v2.1: New structured topic interface ── */

export type TrendTag = "暴涨" | "平稳" | "降温" | "潜力黑马";
export type RiskLevel = "低" | "中" | "高";

interface HotTopic {
  id: string;
  title: string;
  source: string;
  url: string;
  snippet: string;
  heatScore: number;
  heatLevel: "high" | "medium" | "low";
  publishTime: string;
  trendTag: TrendTag;
  score: number;
  scoreReason: string;
  angles: string[];
  relatedWords: string[];
  riskLevel: RiskLevel;
  isPromotional?: boolean;
  matchedQueries?: string[];
}

interface TrendDataPoint {
  date: string;
  score: number;
}

/* ── Snippet cleaning ── */

function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
    "&#39;": "'", "&#x27;": "'", "&nbsp;": " ", "&#160;": " ",
    "&hellip;": "…", "&mdash;": "—", "&ndash;": "–",
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
  /加微[信]?\s*[：:]?\s*[\w-]+/g, /微信号\s*[：:]?\s*[\w-]+/g,
  /加\s*QQ\s*[群号]?\s*[：:]?\s*[\w-]+/g, /扫码[下载关注]/g,
  /点击下载/g, /私信[领取获取]/g, /关注[公众号领取获取]/g,
  /免费领取/g, /限时免费/g, /长按识别/g,
  /回复\s*[\w]+\s*[领获]/g, /代购|淘宝店铺|闲鱼搜索/g,
  /咨询电话\s*[\d-]+/g, /商务合作\s*[：:]/g,
];

function cleanSnippet(raw: string): string {
  if (!raw) return "";
  let text = decodeHtmlEntities(raw);
  text = text.replace(/<[^>]+>/g, "");
  for (const pattern of AD_PATTERNS) { text = text.replace(pattern, ""); }
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/(.)\1{4,}/g, "$1$1$1");
  text = text.replace(/\n{2,}/g, "\n");
  text = text.trim();
  if (text.length > 300) {
    const sub = text.substring(0, 300);
    const lastSentence = Math.max(
      sub.lastIndexOf("。"), sub.lastIndexOf("！"), sub.lastIndexOf("？"),
      sub.lastIndexOf("."), sub.lastIndexOf("!"), sub.lastIndexOf("?"),
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

/* ── Time range filtering ── */

function parsePublishTime(raw: string): Date | null {
  if (!raw || raw === "今日") return null;
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  } catch { /* ignore */ }
  return null;
}

function isWithinTimeRange(publishTime: string, timeRange: string): boolean {
  const date = parsePublishTime(publishTime);
  if (!date) return true;
  const now = Date.now();
  const diffMs = now - date.getTime();
  const rangeMs: Record<string, number> = {
    "6h": 6 * 60 * 60 * 1000, "1d": 24 * 60 * 60 * 1000, "7d": 7 * 24 * 60 * 60 * 1000,
  };
  const maxMs = rangeMs[timeRange] ?? rangeMs["1d"];
  return diffMs <= maxMs;
}

/* ── Source blacklist + promotional detection ── */

const SOURCE_BLACKLIST = new Set([
  "4gamers.com.tw", "cocomy.net", "buzzjie.com", "kknews.cc",
  "read01.com", "ezvivi.com", "life.tw", "tvbs.com.tw",
  "ctwant.com", "mirrormedia.com.tw",
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

/* ── Trend data generation ── */

function generateTrendData(timeRange: string, items: Array<{ heatScore: number; publishTime: string }>): TrendDataPoint[] {
  const now = new Date();
  const points: TrendDataPoint[] = [];
  if (timeRange === "6h") {
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

/* ── v2.1: Structured LLM analysis (batched) ── */

const ANALYSIS_BATCH_SIZE = 5;

interface LLMAnalysisResult {
  trendTag: TrendTag;
  score: number;
  scoreReason: string;
  angles: string[];
  relatedWords: string[];
  riskLevel: RiskLevel;
}

function generateFallbackAnalysis(title: string, keyword: string, heatScore: number): LLMAnalysisResult {
  const lowerTitle = title.toLowerCase();
  let trendTag: TrendTag = "平稳";
  if (heatScore >= 75) trendTag = "暴涨";
  else if (heatScore >= 55 && heatScore < 75) trendTag = "潜力黑马";
  else if (heatScore < 30) trendTag = "降温";

  let angles: string[];
  if (lowerTitle.includes("教程") || lowerTitle.includes("如何") || lowerTitle.includes("怎么")) {
    angles = [`以「${keyword}新手指南」为主题，制作一篇保姆级实操教程`, `拍摄一支「${keyword}避坑指南」短视频，分享常见误区`];
  } else if (lowerTitle.includes("排行") || lowerTitle.includes("推荐") || lowerTitle.includes("测评")) {
    angles = [`做一期「${keyword}红黑榜」对比评测内容`, `以个人体验为切入点，分享真实使用感受`];
  } else if (lowerTitle.includes("趋势") || lowerTitle.includes("未来") || lowerTitle.includes("预测")) {
    angles = [`深度分析「${keyword}未来趋势」，结合数据做预判`, `制作「行业现状」信息图/长图内容`];
  } else {
    angles = [`围绕「${keyword}」制作一篇观点鲜明的评论文章`, `以个人经历切入，分享引发共鸣的故事`, `做一期「${keyword}入门到进阶」系列内容规划`];
  }

  const relatedWords = [
    `${keyword}教程`, `${keyword}推荐`, `${keyword}避坑`,
    `${keyword}攻略`, `${keyword}测评`, `${keyword}入门`,
  ].slice(0, 5);

  return {
    trendTag,
    score: Math.min(95, Math.max(20, heatScore + Math.round(Math.random() * 15 - 5))),
    scoreReason: `综合热度指数${heatScore}，讨论度${heatScore >= 60 ? "较高" : "一般"}，适合${trendTag === "潜力黑马" ? "提前布局" : "跟进创作"}`,
    angles,
    relatedWords,
    riskLevel: "低",
  };
}

async function analyzeTopicsBatch(
  keyword: string,
  topics: Array<{ title: string; snippet: string; source: string; heatScore: number }>,
  llmClient: LLMClient
): Promise<LLMAnalysisResult[]> {
  const topicsDesc = topics
    .map((t, i) => `${i + 1}. [${t.source}] ${t.title} (热度:${t.heatScore})\n   摘要: ${t.snippet.substring(0, 100)}`)
    .join("\n");

  const prompt = `你是资深内容策划专家，帮助创作者评估选题价值。
用户搜索关键词：「${keyword}」
以下是${topics.length}条热点：

${topicsDesc}

请严格输出JSON数组，每个元素对应一条热点，格式如下（不要输出markdown，不要额外解释）：
[{"trendTag":"暴涨|平稳|降温|潜力黑马","score":75,"scoreReason":"一句话说明评分理由","angles":["可创作角度1","角度2","角度3"],"relatedWords":["长尾词1","长尾词2","长尾词3","长尾词4"],"riskLevel":"低|中|高"}]

规则：
- trendTag：暴涨=已爆火讨论度极高；潜力黑马=热度未顶但快速上涨适合提前布局；平稳=稳定讨论；降温=热度下降
- score：0-100，综合=讨论热度×0.4+普通人可创作性×0.3+传播潜力×0.3
- scoreReason：1句话，说明为什么给这个分
- angles：2-3个具体可操作的创作切入角度（禁止复述热点事件，要告诉创作者具体怎么切入）
- relatedWords：3-8个相关长尾搜索词，适合做标题和标签
- riskLevel：低=安全；中=需注意措辞；高=涉及敏感话题需谨慎`;

  try {
    const response = await llmClient.invoke(
      [
        { role: "system", content: "你是资深内容策划专家。严格输出JSON数组，不要输出markdown代码块标记，不要额外解释文字。确保JSON格式正确。" },
        { role: "user", content: prompt },
      ],
      { model: "doubao-seed-2-0-mini-260215", temperature: 0.7 }
    );

    let content = response.content.trim();
    // Remove markdown code block wrappers if present
    content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    
    // Try to extract JSON array
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      let jsonStr = jsonMatch[0];
      // Fix common JSON issues: trailing commas before } or ]
      jsonStr = jsonStr.replace(/,\s*([}\]])/g, "$1");
      try {
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) {
          return parsed.map((item: Record<string, unknown>): LLMAnalysisResult => {
            const validTrendTags: TrendTag[] = ["暴涨", "平稳", "降温", "潜力黑马"];
            const validRiskLevels: RiskLevel[] = ["低", "中", "高"];
            return {
              trendTag: validTrendTags.includes(item.trendTag as TrendTag) ? (item.trendTag as TrendTag) : "平稳",
              score: typeof item.score === "number" ? Math.min(100, Math.max(0, Math.round(item.score))) : 50,
              scoreReason: typeof item.scoreReason === "string" ? item.scoreReason.slice(0, 80) : "综合评估中等",
              angles: Array.isArray(item.angles)
                ? item.angles.filter((a: unknown): a is string => typeof a === "string").slice(0, 3)
                : [],
              relatedWords: Array.isArray(item.relatedWords)
                ? item.relatedWords.filter((w: unknown): w is string => typeof w === "string").slice(0, 8)
                : [],
              riskLevel: validRiskLevels.includes(item.riskLevel as RiskLevel) ? (item.riskLevel as RiskLevel) : "低",
            };
          });
        }
      } catch {
        // JSON still invalid, fall through to fallback
      }
    }
  } catch (error) {
    console.error("LLM analysis failed for batch:", error);
  }

  // Fallback
  return topics.map((t) => generateFallbackAnalysis(t.title, keyword, t.heatScore));
}

async function analyzeAllTopics(
  keyword: string,
  topics: Array<{ title: string; snippet: string; source: string; heatScore: number }>
): Promise<LLMAnalysisResult[]> {
  const customHeaders: Record<string, string> = {};
  const llmConfig = new LLMConfig();
  const llmClient = new LLMClient(llmConfig, customHeaders);

  // Build batches
  const batches: Array<{ batch: Array<{ title: string; snippet: string; source: string; heatScore: number }>; startIndex: number }> = [];
  for (let i = 0; i < topics.length; i += ANALYSIS_BATCH_SIZE) {
    batches.push({ batch: topics.slice(i, i + ANALYSIS_BATCH_SIZE), startIndex: i });
  }

  // Parallel execution with concurrency limit of 5
  const CONCURRENCY_LIMIT = 5;
  const allResults: LLMAnalysisResult[] = new Array(topics.length);

  for (let groupStart = 0; groupStart < batches.length; groupStart += CONCURRENCY_LIMIT) {
    const group = batches.slice(groupStart, groupStart + CONCURRENCY_LIMIT);
    const groupResults = await Promise.all(
      group.map(async ({ batch, startIndex }) => {
        const results = await analyzeTopicsBatch(keyword, batch, llmClient);
        return { results, startIndex };
      })
    );
    for (const { results, startIndex } of groupResults) {
      for (let i = 0; i < results.length; i++) {
        allResults[startIndex + i] = results[i];
      }
    }
  }

  // Fill any gaps with fallback
  for (let i = 0; i < allResults.length; i++) {
    if (!allResults[i]) {
      allResults[i] = generateFallbackAnalysis(topics[i].title, keyword, topics[i].heatScore);
    }
  }

  return allResults;
}

/* ── Main handler ── */

export async function POST(request: NextRequest) {
  try {
    const { keyword, timeRange, count, stream } = await request.json();

    if (!keyword || typeof keyword !== "string" || keyword.trim().length === 0) {
      return NextResponse.json({ error: "请输入有效的关键词" }, { status: 400 });
    }

    const trimmedKeyword = keyword.trim();
    const validTimeRanges = ["6h", "1d", "7d"] as const;
    const resolvedTimeRange = validTimeRanges.includes(timeRange as typeof validTimeRanges[number])
      ? (timeRange as string) : "1d";
    const maxCount = Math.min(Math.max(count || 50, 1), 50);

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const searchConfig = new SearchConfig();
    const searchClient = new SearchClient(searchConfig, customHeaders);

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

    // Dedup by URL, track matched queries
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    const allItems: Array<{
      title: string; source: string; url: string; snippet: string;
      heatScore: number; heatLevel: "high" | "medium" | "low";
      publishTime: string; isPromotional: boolean; matchedQueries: string[];
    }> = [];

    for (let qi = 0; qi < results.length; qi++) {
      const result = results[qi];
      if (!result.web_items) continue;

      for (const item of result.web_items) {
        const normalizedTitle = (item.title || "").trim();
        if (!normalizedTitle) continue;

        const itemUrl = item.url || "";
        const normalizedUrl = itemUrl.split("?")[0].split("#")[0];
        const dedupKey = normalizedUrl || normalizedTitle;
        if (seenUrls.has(dedupKey) || seenTitles.has(normalizedTitle)) {
          const existing = allItems.find(
            (it) => (it.url.split("?")[0].split("#")[0] || it.title) === dedupKey
          );
          if (existing && !existing.matchedQueries.includes(searchQueries[qi])) {
            existing.matchedQueries.push(searchQueries[qi]);
          }
          continue;
        }

        const cleanedSnippet = cleanSnippet(item.snippet || "");
        const titleLower = normalizedTitle.toLowerCase();
        const snippetLower = cleanedSnippet.toLowerCase();
        const keywordLower = trimmedKeyword.toLowerCase();
        const isRelevant = titleLower.includes(keywordLower) ||
          snippetLower.includes(keywordLower) ||
          keywordLower.split("").some((char: string) => titleLower.includes(char));
        if (!isRelevant && keywordLower.length > 1) continue;
        if (isBlacklisted(itemUrl)) continue;

        const rawPublishTime = item.publish_time || "";
        if (rawPublishTime && !isWithinTimeRange(rawPublishTime, resolvedTimeRange)) continue;

        seenUrls.add(dedupKey);
        seenTitles.add(normalizedTitle);

        const platform = inferPlatform(item.site_name || "", itemUrl);
        const heatScore = computeHeatScore(item.rank_score, item.sort_id);
        const isPromo = detectPromotional(normalizedTitle, cleanedSnippet);

        allItems.push({
          title: normalizedTitle, source: platform, url: itemUrl,
          snippet: cleanedSnippet, heatScore, heatLevel: getHeatLevel(heatScore),
          publishTime: rawPublishTime || "今日",
          isPromotional: isPromo, matchedQueries: [searchQueries[qi]],
        });
      }
    }

    allItems.sort((a, b) => b.heatScore - a.heatScore);
    const topItems = allItems.slice(0, maxCount);

    if (topItems.length === 0) {
      const timeLabels: Record<string, string> = { "6h": "近6小时", "1d": "近24小时", "7d": "近7天" };
      const emptyResult = {
        keyword: trimmedKeyword, topics: [], totalFound: 0,
        message: `暂未搜到「${trimmedKeyword}」在${timeLabels[resolvedTimeRange] || "近24小时"}内的相关热点，试试更换其他关键词或扩大时间范围`,
        trendData: generateTrendData(resolvedTimeRange, []),
      };
      if (stream) {
        // SSE: send empty result then done
        const encoder = new TextEncoder();
        const sseStream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "meta", total: 0, trendData: emptyResult.trendData, message: emptyResult.message })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
            controller.close();
          },
        });
        return new Response(sseStream, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
        });
      }
      return NextResponse.json(emptyResult);
    }

    // ── SSE Streaming mode ──
    if (stream) {
      return handleSSEStream(trimmedKeyword, resolvedTimeRange, topItems, allItems);
    }

    // ── JSON mode (parallel processing) ──
    const topicsForLLM = topItems.map((item) => ({
      title: item.title, snippet: item.snippet, source: item.source, heatScore: item.heatScore,
    }));

    const analyses = await analyzeAllTopics(trimmedKeyword, topicsForLLM);

    const topics: HotTopic[] = topItems.map((item, index) => {
      const analysis = analyses[index] || generateFallbackAnalysis(item.title, trimmedKeyword, item.heatScore);
      return {
        id: item.url || `topic-${index}`,
        title: item.title,
        source: item.source,
        url: item.url,
        snippet: item.snippet,
        heatScore: item.heatScore,
        heatLevel: item.heatLevel,
        publishTime: item.publishTime,
        trendTag: analysis.trendTag,
        score: analysis.score,
        scoreReason: analysis.scoreReason,
        angles: analysis.angles.length > 0 ? analysis.angles : ["围绕该话题制作一篇深度分析内容", "以个人视角切入分享独特观点"],
        relatedWords: analysis.relatedWords,
        riskLevel: analysis.riskLevel,
        isPromotional: item.isPromotional,
        matchedQueries: item.matchedQueries.length > 1 ? item.matchedQueries : undefined,
      };
    });

    const trendData = generateTrendData(resolvedTimeRange, allItems);

    return NextResponse.json({
      keyword: trimmedKeyword, topics, totalFound: allItems.length, trendData,
    });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json({ error: "搜索服务暂时不可用，请稍后重试" }, { status: 500 });
  }
}

/* ── SSE Streaming handler ── */

function handleSSEStream(
  keyword: string,
  resolvedTimeRange: string,
  topItems: Array<{
    title: string; source: string; url: string; snippet: string;
    heatScore: number; heatLevel: "high" | "medium" | "low";
    publishTime: string; isPromotional: boolean; matchedQueries: string[];
  }>,
  allItems: Array<{ heatScore: number; publishTime: string }>
) {
  const encoder = new TextEncoder();
  const trendData = generateTrendData(resolvedTimeRange, allItems);
  const totalItems = topItems.length;
  const FIRST_SCREEN_COUNT = 20;

  const sseStream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Step 1: Send meta info immediately
        send({ type: "meta", total: totalItems, trendData });

        // Step 2: LLM analyze first 20 items (priority)
        const firstScreenItems = topItems.slice(0, FIRST_SCREEN_COUNT);
        const firstTopicsForLLM = firstScreenItems.map((item) => ({
          title: item.title, snippet: item.snippet, source: item.source, heatScore: item.heatScore,
        }));

        const llmConfig = new LLMConfig();
        const llmClient = new LLMClient(llmConfig, {});

        // Process first screen batches in parallel
        const firstBatches: Array<{ batch: Array<{ title: string; snippet: string; source: string; heatScore: number }>; index: number }> = [];
        for (let i = 0; i < firstTopicsForLLM.length; i += ANALYSIS_BATCH_SIZE) {
          firstBatches.push({ batch: firstTopicsForLLM.slice(i, i + ANALYSIS_BATCH_SIZE), index: Math.floor(i / ANALYSIS_BATCH_SIZE) });
        }

        let completedCount = 0;
        const firstAnalyses: LLMAnalysisResult[] = new Array(firstTopicsForLLM.length);

        // All first-screen batches in parallel
        const firstResults = await Promise.all(
          firstBatches.map(async ({ batch, index }) => {
            const results = await analyzeTopicsBatch(keyword, batch, llmClient);
            return { results, batchIndex: index };
          })
        );

        for (const { results, batchIndex } of firstResults) {
          const startIndex = batchIndex * ANALYSIS_BATCH_SIZE;
          for (let i = 0; i < results.length; i++) {
            firstAnalyses[startIndex + i] = results[i];
          }
          completedCount += results.length;
        }

        // Fill gaps with fallback
        for (let i = 0; i < firstAnalyses.length; i++) {
          if (!firstAnalyses[i]) {
            firstAnalyses[i] = generateFallbackAnalysis(firstScreenItems[i].title, keyword, firstScreenItems[i].heatScore);
          }
        }

        // Build first screen topics and send
        const firstTopics: HotTopic[] = firstScreenItems.map((item, index) => {
          const analysis = firstAnalyses[index];
          return {
            id: item.url || `topic-${index}`,
            title: item.title,
            source: item.source,
            url: item.url,
            snippet: item.snippet,
            heatScore: item.heatScore,
            heatLevel: item.heatLevel,
            publishTime: item.publishTime,
            trendTag: analysis.trendTag,
            score: analysis.score,
            scoreReason: analysis.scoreReason,
            angles: analysis.angles.length > 0 ? analysis.angles : ["围绕该话题制作一篇深度分析内容", "以个人视角切入分享独特观点"],
            relatedWords: analysis.relatedWords,
            riskLevel: analysis.riskLevel,
            isPromotional: item.isPromotional,
            matchedQueries: item.matchedQueries.length > 1 ? item.matchedQueries : undefined,
          };
        });

        send({ type: "batch", topics: firstTopics, offset: 0, completed: completedCount, total: totalItems });

        // Step 3: LLM analyze remaining items
        const remainingItems = topItems.slice(FIRST_SCREEN_COUNT);
        if (remainingItems.length > 0) {
          const remainingTopicsForLLM = remainingItems.map((item) => ({
            title: item.title, snippet: item.snippet, source: item.source, heatScore: item.heatScore,
          }));

          const remainingBatches: Array<{ batch: Array<{ title: string; snippet: string; source: string; heatScore: number }>; index: number }> = [];
          for (let i = 0; i < remainingTopicsForLLM.length; i += ANALYSIS_BATCH_SIZE) {
            remainingBatches.push({ batch: remainingTopicsForLLM.slice(i, i + ANALYSIS_BATCH_SIZE), index: Math.floor(i / ANALYSIS_BATCH_SIZE) });
          }

          // All remaining batches in parallel
          const remainingResults = await Promise.all(
            remainingBatches.map(async ({ batch, index }) => {
              const results = await analyzeTopicsBatch(keyword, batch, llmClient);
              return { results, batchIndex: index };
            })
          );

          const remainingAnalyses: LLMAnalysisResult[] = new Array(remainingTopicsForLLM.length);
          for (const { results, batchIndex } of remainingResults) {
            const startIndex = batchIndex * ANALYSIS_BATCH_SIZE;
            for (let i = 0; i < results.length; i++) {
              remainingAnalyses[startIndex + i] = results[i];
            }
            completedCount += results.length;
          }

          // Fill gaps
          for (let i = 0; i < remainingAnalyses.length; i++) {
            if (!remainingAnalyses[i]) {
              remainingAnalyses[i] = generateFallbackAnalysis(remainingItems[i].title, keyword, remainingItems[i].heatScore);
            }
          }

          const remainingTopics: HotTopic[] = remainingItems.map((item, index) => {
            const analysis = remainingAnalyses[index];
            return {
              id: item.url || `topic-${FIRST_SCREEN_COUNT + index}`,
              title: item.title,
              source: item.source,
              url: item.url,
              snippet: item.snippet,
              heatScore: item.heatScore,
              heatLevel: item.heatLevel,
              publishTime: item.publishTime,
              trendTag: analysis.trendTag,
              score: analysis.score,
              scoreReason: analysis.scoreReason,
              angles: analysis.angles.length > 0 ? analysis.angles : ["围绕该话题制作一篇深度分析内容", "以个人视角切入分享独特观点"],
              relatedWords: analysis.relatedWords,
              riskLevel: analysis.riskLevel,
              isPromotional: item.isPromotional,
              matchedQueries: item.matchedQueries.length > 1 ? item.matchedQueries : undefined,
            };
          });

          send({ type: "batch", topics: remainingTopics, offset: FIRST_SCREEN_COUNT, completed: completedCount, total: totalItems });
        }

        // Done
        send({ type: "done" });
      } catch (error) {
        console.error("SSE stream error:", error);
        send({ type: "error", message: "分析过程出错" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(sseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
