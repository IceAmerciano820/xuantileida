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
  // v2.6: 营销软文特征
  "十大.*app", "十大.*平台", "一天.*元", "倍爆款率", "%存活率",
  "月入.*万", "日入.*元", "躺赚", "零成本创业",
  "保姆级教程", "建议收藏", "必看", "不容错过",
  // v2.7: 更多营销特征
  "亲测.*月入", "接单赚钱", "副业.*日入", "爆款率.*%",
  "存活率.*%", "转化率.*%", "收益.*倍",
];

const PROMO_PATTERNS = [
  /十大[\w\s]*(app|平台|软件|网站)/i,
  /一天[\d.]+元/,
  /[\d.]+倍爆款率/,
  /[\d.]+%存活率/,
  /月入[\d.]+万/,
  /日入[\d.]+元/,
  // v2.7: 更多营销模式
  /亲测.*月入[\d.]+/,
  /接单赚钱/,
  /副业.*日入[\d.]+/,
  // v2.7.4: 精准化 - "X倍" 必须搭配赚钱/收益/爆款等词才算软文
  /[\d.]+倍.*(收益|赚钱|收入|爆款|利润|回报)/,
  /[\d.]+%.*(转化率|存活率|成功率|收益率)/,
  // v2.7.2: 更多营销特征 - 精准化
  // "亲测" 必须搭配赚钱/副业/兼职等词才算软文
  /亲测.*(赚钱|副业|兼职|搞钱|月入|日入|收入|生意)/,
  /下班就能赚/,
  /可靠副业/,
  /副业小生意/,
  /月入\d+/,
  /日入\d+/,
  /赚钱.*副业/,
  /副业.*赚钱/,
  // v2.7.4: 推荐类软文
  /(推荐|安利).*(兼职|副业|赚钱|搞钱)/,
  // v2.7.5: 推荐指南类软文 - 标题含推荐指南/优选/排行榜/盘点 + 工具/平台/软件/APP，且正文含裂变/涨粉/出单/变现/带货
];

// v2.7.5: 推荐指南类软文检测（需要标题和正文组合判断）
function isRecommendationSpam(title: string, snippet: string): boolean {
  const titleLower = title.toLowerCase();
  const snippetLower = snippet.toLowerCase();
  // 标题含推荐指南/优选/排行榜/盘点 + 工具/平台/软件/APP
  const hasRecommendPattern = /(推荐指南|优选|排行榜|盘点|十大|榜单)/.test(titleLower);
  const hasToolPattern = /(工具|平台|软件|app|系统)/.test(titleLower);
  // 正文含裂变/涨粉/出单/变现/带货
  const hasMonetizePattern = /(裂变|涨粉|出单|变现|带货|引流|获粉|吸粉)/.test(snippetLower);
  return hasRecommendPattern && hasToolPattern && hasMonetizePattern;
}

// v2.7: 政务/公告类过滤
const GOV_PATTERNS = [
  /开展.*讲座/,
  /召开.*会议/,
  /关于.*的通知/,
  /关于.*的公告/,
  /开园/,
  /总决赛开赛/,
  /启动仪式/,
  /签约仪式/,
  /新闻发布会/,
  /政策.*解读/,
  /条例.*实施/,
  // v2.7.2: 更多通稿特征
  /圆满落幕/,
  /成功举办/,
  /正式开幕/,
  /胜利闭幕/,
  /圆满收官/,
  /顺利召开/,
  /隆重开幕/,
];

function isGovernmentContent(title: string, snippet: string): boolean {
  const text = title + " " + snippet;
  // Check if it matches government patterns
  const matchesGov = GOV_PATTERNS.some((pattern) => pattern.test(text));
  if (!matchesGov) return false;
  // Check if it has mass discussion points (social media engagement indicators)
  const hasDiscussionPoints = /评论|讨论|网友|热议|争议|吐槽|点赞|转发|收藏/.test(text);
  // If it matches gov patterns but has no discussion points, filter it out
  return !hasDiscussionPoints;
}

function detectPromotional(title: string, snippet: string): boolean {
  const text = (title + " " + snippet).toLowerCase();
  // Check simple signals
  if (PROMO_SIGNALS.some((sig) => text.includes(sig.toLowerCase()))) return true;
  // Check regex patterns
  if (PROMO_PATTERNS.some((pattern) => pattern.test(text))) return true;
  // v2.7.5: 推荐指南类软文
  if (isRecommendationSpam(title, snippet)) return true;
  return false;
}

/* ── v2.7: Main domain extraction for dedup ── */

function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// v2.7.4: Explicit domain family mapping table
// Only merge domains that are truly the same entity
const DOMAIN_FAMILY_MAP: Record<string, string> = {
  // sina family
  "sina.com.cn": "sina",
  "sina.cn": "sina",
  "sina.com": "sina",
  "weibo.cn": "sina",
  "weibo.com": "sina",
  "weibo.com.cn": "sina",
  "k.sina.cn": "sina",
  "k.sina.com.cn": "sina",
  // toutiao family (v2.7.5: include weitoutiao.zjurl.cn as byteDance domain)
  "toutiao.com": "toutiao",
  "toutiao.cn": "toutiao",
  "m.toutiao.com": "toutiao",
  "www.toutiao.com": "toutiao",
  "weitoutiao.zjurl.cn": "toutiao",
  // sohu family
  "sohu.com": "sohu",
  "sohu.com.cn": "sohu",
  "sohu.cn": "sohu",
  // smzdm family
  "smzdm.com": "smzdm",
  // baidu family
  "baidu.com": "baidu",
  "baidu.cn": "baidu",
  // qq family
  "qq.com": "qq",
  // 163 family
  "163.com": "163",
  // ifeng family
  "ifeng.com": "ifeng",
  // cctv/cntv family
  "cctv.com": "cctv",
  "cntv.cn": "cctv",
  "cetv.cn": "cctv",
  // people family
  "people.com.cn": "people",
  // xinhuanet family
  "xinhuanet.com": "xinhuanet",
  "news.cn": "xinhuanet",
  // china family
  "china.com.cn": "china",
  // cnr family
  "cnr.cn": "cnr",
};

// v2.7.4: Extract main domain with explicit mapping + fallback
function extractMainDomain(url: string): string {
  const domain = extractDomain(url);
  if (!domain) return "";
  
  // Check explicit mapping first
  if (DOMAIN_FAMILY_MAP[domain]) {
    return DOMAIN_FAMILY_MAP[domain];
  }
  
  // Handle common Chinese domains and special cases
  const parts = domain.split(".");
  if (parts.length <= 2) return domain;
  
  // Special handling for common Chinese TLDs
  const chineseTlds = ["com.cn", "net.cn", "org.cn", "gov.cn", "edu.cn"];
  for (const tld of chineseTlds) {
    if (domain.endsWith(tld)) {
      // For "he.people.com.cn", return "people.com.cn"
      const baseParts = domain.slice(0, -tld.length - 1).split(".");
      return baseParts[baseParts.length - 1] + "." + tld;
    }
  }
  
  // Default: take last two parts
  return parts.slice(-2).join(".");
}

// v2.7: 同主域名最多保留 MAX_PER_DOMAIN 条
const MAX_PER_DOMAIN = 3;

function deduplicateByDomain<T extends { url: string }>(items: T[]): T[] {
  const domainCount = new Map<string, number>();
  const result: T[] = [];
  for (const item of items) {
    const mainDomain = extractMainDomain(item.url);
    if (!mainDomain) {
      result.push(item);
      continue;
    }
    const count = domainCount.get(mainDomain) || 0;
    if (count < MAX_PER_DOMAIN) {
      result.push(item);
      domainCount.set(mainDomain, count + 1);
    }
  }
  return result;
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

const ANALYSIS_BATCH_SIZE = 3; // v2.7.1: reduced from 5 to improve success rate

interface LLMAnalysisResult {
  trendTag: TrendTag;
  score: number;
  scoreReason: string;
  angles: string[];
  relatedWords: string[];
  riskLevel: RiskLevel;
}

/* ── v2.7: Expanded fallback angle library (20+ patterns) ── */

// Extract key entities from title for embedding in angles
function extractTitleEntities(title: string): { entities: string[]; numbers: string[] } {
  // Extract numbers, but filter out years (4-digit numbers like 2024, 2025, 2026)
  const allNumbers = title.match(/\d+/g) || [];
  const numbers = allNumbers.filter(n => {
    // Filter out years (1900-2099)
    const num = parseInt(n, 10);
    if (num >= 1900 && num <= 2099 && n.length === 4) return false;
    return true;
  });
  // Extract quoted terms
  const quoted = title.match(/[""「」【】]([^"」】]+)[""「」【】]/g) || [];
  // Extract capitalized terms (for English) or Chinese terms
  const entities: string[] = [];
  // Add quoted terms
  for (const q of quoted) {
    entities.push(q.replace(/[""「」【】]/g, ""));
  }
  // Add product/brand names (common patterns)
  const brandPatterns = title.match(/[\u4e00-\u9fa5]{2,6}(APP|平台|工具|软件|服务|品牌)/g) || [];
  for (const b of brandPatterns) {
    entities.push(b);
  }
  return { entities, numbers };
}

// v2.7: 20+ angle patterns, randomly selected, embedded with title entities
// v2.7.5: Remove ALL number placeholders - no more "N个" patterns to avoid absurd outputs like "4000个错误"
const ANGLE_PATTERNS: Array<(kw: string, ent: string[]) => string> = [
  (kw, ent) => `实测${ent[0] || kw}完整流程，记录每个步骤的真实耗时和踩坑点`,
  (kw, ent) => `拍一支"${ent[0] || kw}新手最容易搞错的几个点"短视频`,
  () => `对比官方说法和实际操作，找出那些没写清楚的隐藏细节`,
  (kw) => `自费买了几款热门${kw}，逐个实测告诉你哪个值`,
  () => `做一期红黑榜，踩雷的和真香的都列出来`,
  () => `从价格/效果/体验三个维度横向对比，给出不同预算的选择`,
  (kw, ent) => `整理了近半年的数据，${ent[0] || kw}的变化比你想的大`,
  (kw, ent) => `跟几位从业者聊了聊，他们对${ent[0] || kw}的看法不太一样`,
  (kw) => `从政策/技术/市场三个层面分析${kw}的真实走向`,
  (kw, ent) => `围绕「${ent[0] || kw}」的最新动态，梳理事件关键争议点`,
  (kw) => `针对${kw}的常见误解，用实际数据或体验来澄清`,
  (kw, ent) => `不同价位的${ent[0] || kw}差距到底在哪，实测告诉你`,
  (kw, ent) => `问了身边朋友，他们对${ent[0] || kw}的回答让我意外`,
  (kw, ent) => `我试了一周${ent[0] || kw}，踩坑经历复盘`,
  (kw, ent) => `${ent[0] || kw}的几个真相，最让人意外的那个`,
  (kw, ent) => `${ent[0] || kw}翻车实录：花钱买的教训整理`,
  (kw) => `为什么${kw}突然火了？我挖了挖背后的原因`,
  (kw, ent) => `${ent[0] || kw}避坑指南：这些错误我替你踩过了`,
  (kw, ent) => `${ent[0] || kw}深度体验报告：用了一段时间后的真实感受`,
  (kw) => `${kw}新手入门：从零开始的完整指南`,
  (kw, ent) => `对比了几款${ent[0] || kw}，这款性价比最高`,
  (kw, ent) => `${ent[0] || kw}使用一段时间后，说说真实体验`,
  (kw) => `${kw}怎么选？看完这篇就不纠结了`,
  (kw, ent) => `${ent[0] || kw}的隐藏用法，老手都不一定知道`,
  (kw, ent) => `实测几种${ent[0] || kw}方案，最便宜的反而最好用`,
  (kw, ent) => `${ent[0] || kw}上手技巧整理，新手必看`,
  (kw, ent) => `扒一扒${ent[0] || kw}的真实体验，和宣传差多少`,
  (kw) => `${kw}到底值不值得入？说说我的真实感受`,
];

function generateFallbackAnalysis(title: string, keyword: string, heatScore: number): LLMAnalysisResult {
  const { entities } = extractTitleEntities(title);
  
  let trendTag: TrendTag = "平稳";
  if (heatScore >= 75) trendTag = "暴涨";
  else if (heatScore >= 55 && heatScore < 75) trendTag = "潜力黑马";
  else if (heatScore < 30) trendTag = "降温";

  // v2.7.5: Randomly select 3 unique angle patterns (no number slots)
  const shuffled = [...ANGLE_PATTERNS].sort(() => Math.random() - 0.5);
  const angles = shuffled.slice(0, 3).map((pattern) => pattern(keyword, entities));

  // v2.7: Ensure relatedWords >= 5
  const baseRelatedWords = [
    `${keyword}实测`, `${keyword}避坑`, `${keyword}怎么选`,
    `${keyword}真实体验`, `${keyword}对比`, `${keyword}推荐`,
    `${keyword}教程`, `${keyword}攻略`, `${keyword}评测`,
  ];
  // Add entity-based related words if available
  if (entities.length > 0) {
    baseRelatedWords.push(`${entities[0]}评测`, `${entities[0]}怎么样`);
  }
  const relatedWords = baseRelatedWords.slice(0, 7);

  // v2.7: More specific scoreReason, avoid generic phrases
  // Use title entities to make it specific
  const entityHint = entities.length > 0 ? entities[0] : title.slice(0, 6);
  const scoreReason = heatScore >= 70
    ? `「${entityHint}」近期讨论集中，有多个具体事件/产品可切入`
    : heatScore >= 50
    ? `「${entityHint}」有新鲜讨论点，结合个人经历能做出差异化`
    : `「${entityHint}」竞争不算激烈，适合先占位积累`;

  return {
    trendTag,
    score: Math.min(95, Math.max(20, heatScore + Math.round(Math.random() * 15 - 5))),
    scoreReason,
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
- scoreReason：1句话说人话，像编辑给作者的建议。必须结合该条热点的具体事实（标题/摘要中的实体、数字、事件）来写。例如"XX品牌这次翻车涉及3款产品，讨论度高但普通人不好拍，适合有相关经历的人做""这个政策影响的是XX群体，热度一般但切入点独特，适合小众赛道博主"。禁止"该话题具有较高的时效性与传播潜力"式公文腔。禁止"讨论的人多，但角度同质化严重""热度一般，不过竞争也小"这类万能空话。
- angles：3个具体可操作的选题切入点，像编辑报选题一样写。必须结合该条热点的具体事实来写，3个角度方向要不同（如：亲测体验型/观点评论型/干货教程型/反差争议型，至少覆盖2种）。例如"我试了一周XX，踩了3个坑""花50块vs花500块，差距到底在哪""问了10个朋友，他们的回答让我意外"。禁止"深入探讨XX的发展趋势""全方位解析XX"这种假大空角度。禁止"从一个普通用户的视角聊聊这件事""自己试了一遍XX，把踩的坑整理出来"这类万能句式。每条angles必须包含该热点的具体实体/事件/数字。
- relatedWords：5-7个相关长尾搜索词，适合做标题和标签（必填，不允许为空）
- riskLevel：低=安全；中=需注意措辞；高=涉及敏感话题需谨慎

【去AI味规则 - 严格执行】
- 禁止使用"赋能、助力、打造、构建、深度探讨、全方位、多维度、显著、持续优化、无缝、直观、强大、革命性、颠覆性"等AI高频词
- 禁止"首先/其次/最后"的机械结构
- 禁止在同批结果中复用句式：每条angles和scoreReason必须独特，禁止"从一个普通用户的视角聊聊""自己试了一遍XX"这类万能句式在不同条目中重复出现
- 所有输出用口语化表达，像真人在说话
- 每条angles必须包含该热点的具体实体/事件/数字，不允许出现可套用到任何话题的空泛角度
- 【数字使用规则】：angles中出现的具体数字必须是标题/摘要中的原始事实，且语义必须匹配。例如标题说"花4000元"，角度中可以说"花4000元"但不能说"4000个错误"。禁止将金额、年份等数字填入"N个"句式。如果标题中没有合适的数字，就不要在角度中使用具体数字，改用"几个""一些"等模糊表述`;

  // v2.7.1: Add retry logic for LLM calls
  const MAX_RETRIES = 2;
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await llmClient.invoke(
        [
          { role: "system", content: "你是资深内容策划专家，说人话，不说AI腔。严格输出JSON数组，不要输出markdown代码块标记，不要额外解释文字。确保JSON格式正确。所有文字用口语化表达，像真人在说话。" },
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
          const results = parsed.map((item: Record<string, unknown>): LLMAnalysisResult => {
            const validTrendTags: TrendTag[] = ["暴涨", "平稳", "降温", "潜力黑马"];
            const validRiskLevels: RiskLevel[] = ["低", "中", "高"];
            const rawRelatedWords = Array.isArray(item.relatedWords)
              ? item.relatedWords.filter((w: unknown): w is string => typeof w === "string").slice(0, 8)
              : [];
            // v2.6: 确保 relatedWords 至少有5个
            const relatedWords = rawRelatedWords.length >= 5
              ? rawRelatedWords
              : [...rawRelatedWords, ...generateRelatedWordsFromTitle(String(item.title || ""))].slice(0, 7);
            return {
              trendTag: validTrendTags.includes(item.trendTag as TrendTag) ? (item.trendTag as TrendTag) : "平稳",
              score: typeof item.score === "number" ? Math.min(100, Math.max(0, Math.round(item.score))) : 50,
              scoreReason: typeof item.scoreReason === "string" ? item.scoreReason.slice(0, 80) : "热度中等，适合找个独特角度切入",
              angles: Array.isArray(item.angles)
                ? item.angles.filter((a: unknown): a is string => typeof a === "string").slice(0, 3)
                : [],
              relatedWords,
              riskLevel: validRiskLevels.includes(item.riskLevel as RiskLevel) ? (item.riskLevel as RiskLevel) : "低",
            };
          });
          return results; // Success, return results
        }
      } catch {
        // JSON still invalid, fall through to retry or fallback
      }
    }
    // If we parsed successfully, results would have been returned above
    // Fall through to retry
  } catch (error) {
    lastError = error as Error;
    console.error(`LLM analysis attempt ${attempt + 1} failed:`, error);
    if (attempt < MAX_RETRIES - 1) {
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  }

  // Fallback
  if (lastError) {
    console.error("LLM analysis failed after retries:", lastError);
  }
  return topics.map((t) => generateFallbackAnalysis(t.title, keyword, t.heatScore));
}

// v2.6: 从标题生成相关长尾词
function generateRelatedWordsFromTitle(title: string): string[] {
  const words: string[] = [];
  // 提取标题中的关键词组合
  const segments = title.split(/[\s,，。！？、]+/).filter((s) => s.length >= 2);
  for (const seg of segments.slice(0, 3)) {
    words.push(seg);
    if (seg.length > 4) {
      words.push(seg.slice(0, 4) + "怎么样");
    }
  }
  // 添加通用后缀
  const suffixes = ["推荐", "测评", "教程", "攻略", "避坑"];
  const mainKeyword = segments[0] || "这个";
  for (const suffix of suffixes.slice(0, 3)) {
    words.push(mainKeyword + suffix);
  }
  return [...new Set(words)].slice(0, 7);
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

  // v2.7.5: Funnel logging - LLM results
  const llmSuccessCount = allResults.filter(r => r !== undefined).length;
  const llmFailCount = topics.length - llmSuccessCount;
  console.log(`[漏斗] ${keyword} - ④LLM批处理: 成功${llmSuccessCount}条/失败${llmFailCount}条`);

  // Fill any gaps with fallback
  let fallbackCount = 0;
  for (let i = 0; i < allResults.length; i++) {
    if (!allResults[i]) {
      allResults[i] = generateFallbackAnalysis(topics[i].title, keyword, topics[i].heatScore);
      fallbackCount++;
    }
  }
  if (fallbackCount > 0) {
    console.log(`[漏斗] ${keyword} - ④fallback补充:${fallbackCount}条`);
  }

  // v2.7: Post-processing - deduplicate angles and scoreReason across batch
  const seenAngles = new Set<string>();
  const seenReasons = new Set<string>();
  
  for (let i = 0; i < allResults.length; i++) {
    const result = allResults[i];
    if (!result) continue;
    
    // Normalize and check for duplicate angles
    const normalizedAngles = result.angles.map((a) => 
      a.replace(/[\s\d]/g, "").toLowerCase()
    );
    
    const uniqueAngles: string[] = [];
    for (let j = 0; j < result.angles.length; j++) {
      const normalized = normalizedAngles[j];
      // Check if this angle is too similar to any seen angle
      const isDuplicate = Array.from(seenAngles).some((seen) => {
        // Simple similarity: if 80% of characters match
        const commonChars = normalized.split("").filter((c) => seen.includes(c)).length;
        return commonChars / Math.max(normalized.length, seen.length) > 0.8;
      });
      
      if (!isDuplicate || uniqueAngles.length < 2) {
        uniqueAngles.push(result.angles[j]);
        seenAngles.add(normalized);
      }
    }
    
    // If we lost angles due to dedup, regenerate from fallback
    if (uniqueAngles.length < 3) {
      const fallback = generateFallbackAnalysis(topics[i].title, keyword, topics[i].heatScore);
      for (const angle of fallback.angles) {
        if (uniqueAngles.length >= 3) break;
        const normalized = angle.replace(/[\s\d]/g, "").toLowerCase();
        if (!seenAngles.has(normalized)) {
          uniqueAngles.push(angle);
          seenAngles.add(normalized);
        }
      }
    }
    result.angles = uniqueAngles.slice(0, 3);
    
    // Deduplicate scoreReason
    const normalizedReason = result.scoreReason.replace(/[\s\d]/g, "").toLowerCase();
    if (seenReasons.has(normalizedReason)) {
      // Regenerate with fallback
      const fallback = generateFallbackAnalysis(topics[i].title, keyword, topics[i].heatScore);
      result.scoreReason = fallback.scoreReason;
    }
    seenReasons.add(normalizedReason);
    
    // v2.7: Ensure relatedWords >= 5
    if (result.relatedWords.length < 5) {
      const fallback = generateFallbackAnalysis(topics[i].title, keyword, topics[i].heatScore);
      result.relatedWords = [...new Set([...result.relatedWords, ...fallback.relatedWords])].slice(0, 7);
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
    const maxCount = Math.min(Math.max(count || 30, 1), 30);

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const searchConfig = new SearchConfig();
    const searchClient = new SearchClient(searchConfig, customHeaders);

    // v2.7: Add social media sources with site-specific searches
    const searchQueries = [
      `${trimmedKeyword} 热点 热门话题 最新`,
      `${trimmedKeyword} 微博 知乎 讨论`,
      `${trimmedKeyword} 抖音 小红书 爆款`,
      `${trimmedKeyword} 体验 测评 分享`,
      `${trimmedKeyword} 教程 攻略 技巧`,
    ];

    // v2.7: Social media site-specific searches
    const socialMediaSites = [
      "weibo.com,zhihu.com",  // 微博+知乎
      "douyin.com,xiaohongshu.com",  // 抖音+小红书
      "bilibili.com",  // B站
    ];

    const searchPromises = searchQueries.map((query, idx) =>
      searchClient.advancedSearch(query, {
        timeRange: resolvedTimeRange,
        count: 25,
        needSummary: false,
      }).catch((err: unknown) => {
        console.error(`Search failed for query ${idx}:`, err);
        return { web_items: [] };
      })
    );

    // v2.7: Add social media site-specific searches
    const socialMediaPromises = socialMediaSites.map((sites, idx) =>
      searchClient.advancedSearch(trimmedKeyword, {
        timeRange: resolvedTimeRange,
        count: 15,
        sites: sites,
        needSummary: false,
      }).catch((err: unknown) => {
        console.error(`Social media search failed for sites ${idx}:`, err);
        return { web_items: [] };
      })
    );

    const allSearchPromises = [...searchPromises, ...socialMediaPromises];
    const results = await Promise.all(allSearchPromises);

    // v2.7.5: Funnel logging - search results count
    let baseSearchCount = 0;
    let socialMediaCount = 0;
    const socialMediaDetails: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const count = results[i]?.web_items?.length || 0;
      if (i < searchQueries.length) {
        baseSearchCount += count;
      } else {
        socialMediaCount += count;
        const sitesIdx = i - searchQueries.length;
        socialMediaDetails.push(`${socialMediaSites[sitesIdx]}:${count}条`);
      }
    }
    console.log(`[漏斗] ${trimmedKeyword} - ①基础搜索:${baseSearchCount}条 ②社媒定向:${socialMediaCount}条 (${socialMediaDetails.join(', ')})`);

    // Dedup by URL, track matched queries
    const seenUrls = new Set<string>();
    const allItems: Array<{
      title: string; source: string; url: string; snippet: string;
      heatScore: number; heatLevel: "high" | "medium" | "low";
      publishTime: string; isPromotional: boolean; matchedQueries: string[];
    }> = [];

    for (let qi = 0; qi < results.length; qi++) {
      const result = results[qi];
      if (!result.web_items) continue;

      // v2.7: Track which query this result came from
      const queryLabel = qi < searchQueries.length 
        ? searchQueries[qi] 
        : `社媒[${socialMediaSites[qi - searchQueries.length]}]`;

      for (const item of result.web_items) {
        const normalizedTitle = (item.title || "").trim();
        if (!normalizedTitle) continue;

        const itemUrl = item.url || "";
        const normalizedUrl = itemUrl.split("?")[0].split("#")[0];
        // v2.7.5: Only dedup by URL, not title - same news from different sources is valid
        const dedupKey = normalizedUrl || normalizedTitle;
        if (seenUrls.has(dedupKey)) {
          const existing = allItems.find(
            (it) => (it.url.split("?")[0].split("#")[0] || it.title) === dedupKey
          );
          if (existing && !existing.matchedQueries.includes(queryLabel)) {
            existing.matchedQueries.push(queryLabel);
          }
          continue;
        }

        const cleanedSnippet = cleanSnippet(item.snippet || "");
        const titleLower = normalizedTitle.toLowerCase();
        const snippetLower = cleanedSnippet.toLowerCase();
        const keywordLower = trimmedKeyword.toLowerCase();
        // v2.7.5: Relaxed relevance - accept if keyword appears in title OR snippet
        // Also accept if any 2+ char substring of keyword appears
        const isRelevant = titleLower.includes(keywordLower) ||
          snippetLower.includes(keywordLower) ||
          (keywordLower.length >= 2 && keywordLower.split("").some((char: string) => titleLower.includes(char)));
        if (!isRelevant && keywordLower.length > 2) continue;
        if (isBlacklisted(itemUrl)) continue;

        // v2.7: 政务/公告类内容硬过滤
        if (isGovernmentContent(normalizedTitle, cleanedSnippet)) continue;

        const rawPublishTime = item.publish_time || "";
        if (rawPublishTime && !isWithinTimeRange(rawPublishTime, resolvedTimeRange)) continue;

        seenUrls.add(dedupKey);

        const platform = inferPlatform(item.site_name || "", itemUrl);
        const heatScore = computeHeatScore(item.rank_score, item.sort_id);
        const isPromo = detectPromotional(normalizedTitle, cleanedSnippet);

        allItems.push({
          title: normalizedTitle, source: platform, url: itemUrl,
          snippet: cleanedSnippet, heatScore, heatLevel: getHeatLevel(heatScore),
          publishTime: rawPublishTime || "今日",
          isPromotional: isPromo, matchedQueries: [queryLabel],
        });
      }
    }

    allItems.sort((a, b) => {
      // v2.6:  promotional items go to bottom
      if (a.isPromotional !== b.isPromotional) return a.isPromotional ? 1 : -1;
      return b.heatScore - a.heatScore;
    });

    // v2.7.5: Funnel logging - after collection
    console.log(`[漏斗] ${trimmedKeyword} - ③收集去重后:${allItems.length}条`);

    // v2.7.1: 硬过滤 - 营销内容和政务内容直接移除，不从结果中返回
    const promoCount = allItems.filter(it => it.isPromotional).length;
    const govCount = allItems.filter(it => !it.isPromotional && isGovernmentContent(it.title, it.snippet)).length;
    const filteredItems = allItems.filter((it) => {
      // 移除营销软文
      if (it.isPromotional) return false;
      // 移除政务/公告类
      if (isGovernmentContent(it.title, it.snippet)) return false;
      return true;
    });

    // v2.7.5: Funnel logging - after filtering
    console.log(`[漏斗] ${trimmedKeyword} - ⑤软文过滤移除:${promoCount}条 ⑥政务过滤移除:${govCount}条 过滤后:${filteredItems.length}条`);

    // v2.7.5: 同主域名去重（每主域名最多3条），循环执行直到无超限
    let dedupedItems = filteredItems;
    let domainDedupRemoved = 0;
    let prevLength = filteredItems.length;
    do {
      prevLength = dedupedItems.length;
      dedupedItems = deduplicateByDomain(dedupedItems);
      domainDedupRemoved = prevLength - dedupedItems.length;
    } while (domainDedupRemoved > 0);

    // v2.7.5: Funnel logging - after domain dedup
    console.log(`[漏斗] ${trimmedKeyword} - ⑦主域去重移除:${domainDedupRemoved}条 去重后:${dedupedItems.length}条`);

    // v2.7.5: 补位逻辑 - 如果去重后不足maxCount，放宽主域限制补位
    const topItems = dedupedItems.slice(0, maxCount);
    if (topItems.length < maxCount) {
      // 需要从 allItems 中补位（排除已在 topItems 中的）
      const topUrls = new Set(topItems.map(it => it.url));
      // 候选池：所有非软文、非政务、未在topItems中的条目
      const candidates = allItems.filter(it => !topUrls.has(it.url) && !it.isPromotional && !isGovernmentContent(it.title, it.snippet));
      
      // v2.7.5: 放宽主域限制 - 如果候选充足但主域超限，允许每域最多5条
      const relaxedMaxPerDomain = MAX_PER_DOMAIN + 2; // 放宽到5条
      let replenished = 0;
      for (const candidate of candidates) {
        if (topItems.length >= maxCount) break;
        
        // 检查加入该候选后主域是否超限（使用放宽后的限制）
        const candidateDomain = extractMainDomain(candidate.url);
        const currentDomainCount = topItems.filter(it => extractMainDomain(it.url) === candidateDomain).length;
        if (candidateDomain && currentDomainCount >= relaxedMaxPerDomain) continue;
        
        topItems.push(candidate);
        replenished++;
      }
      
      if (replenished > 0) {
        console.log(`[漏斗] ${trimmedKeyword} - 补位:${replenished}条 补位后:${topItems.length}条`);
      }
    }

    // v2.7.5: Final domain dedup check on the returned array - loop until no domain exceeds limit
    let finalDedupIterations = 0;
    while (finalDedupIterations < 5) {
      const domainCounts = new Map<string, number>();
      let hasExcess = false;
      
      // Count domains
      for (const item of topItems) {
        const domain = extractMainDomain(item.url);
        if (domain) {
          domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
          if ((domainCounts.get(domain) || 0) > MAX_PER_DOMAIN) {
            hasExcess = true;
          }
        }
      }
      
      if (!hasExcess) break;
      
      // Remove excess items (keep first MAX_PER_DOMAIN for each domain)
      const domainSeen = new Map<string, number>();
      const toRemove: number[] = [];
      for (let i = 0; i < topItems.length; i++) {
        const domain = extractMainDomain(topItems[i].url);
        if (domain) {
          const count = domainSeen.get(domain) || 0;
          if (count >= MAX_PER_DOMAIN) {
            toRemove.push(i);
          } else {
            domainSeen.set(domain, count + 1);
          }
        }
      }
      
      // Remove items in reverse order to maintain indices
      for (let i = toRemove.length - 1; i >= 0; i--) {
        topItems.splice(toRemove[i], 1);
      }
      
      finalDedupIterations++;
    }

    // v2.7.5: Funnel logging - final count
    console.log(`[漏斗] ${trimmedKeyword} - ⑧最终返回:${topItems.length}条`);

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
        angles: analysis.angles.length > 0 ? analysis.angles : generateFallbackAnalysis(item.title, trimmedKeyword, item.heatScore).angles,
        relatedWords: analysis.relatedWords,
        riskLevel: analysis.riskLevel,
        isPromotional: item.isPromotional,
        matchedQueries: item.matchedQueries.length > 1 ? item.matchedQueries : undefined,
      };
    });

    // v2.7.4: Final normalization dedup on the returned topics array
    const finalSeenAngles = new Set<string>();
    const finalSeenReasons = new Set<string>();
    for (const topic of topics) {
      // Deduplicate angles
      const dedupedAngles: string[] = [];
      for (const angle of topic.angles) {
        const normalized = angle.replace(/[\s\d]/g, "").toLowerCase();
        if (!finalSeenAngles.has(normalized)) {
          dedupedAngles.push(angle);
          finalSeenAngles.add(normalized);
        }
      }
      // If all angles were duplicates, regenerate from fallback
      if (dedupedAngles.length === 0) {
        const fallback = generateFallbackAnalysis(topic.title, keyword, topic.heatScore);
        for (const angle of fallback.angles) {
          if (dedupedAngles.length >= 3) break;
          const normalized = angle.replace(/[\s\d]/g, "").toLowerCase();
          if (!finalSeenAngles.has(normalized)) {
            dedupedAngles.push(angle);
            finalSeenAngles.add(normalized);
          }
        }
      }
      topic.angles = dedupedAngles.slice(0, 3);
      
      // Deduplicate scoreReason
      const normalizedReason = topic.scoreReason.replace(/[\s\d]/g, "").toLowerCase();
      if (finalSeenReasons.has(normalizedReason)) {
        const fallback = generateFallbackAnalysis(topic.title, keyword, topic.heatScore);
        const newReason = fallback.scoreReason.replace(/[\s\d]/g, "").toLowerCase();
        if (!finalSeenReasons.has(newReason)) {
          topic.scoreReason = fallback.scoreReason;
          finalSeenReasons.add(newReason);
        }
      } else {
        finalSeenReasons.add(normalizedReason);
      }
    }

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
            angles: analysis.angles.length > 0 ? analysis.angles : generateFallbackAnalysis(item.title, keyword, item.heatScore).angles,
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
              angles: analysis.angles.length > 0 ? analysis.angles : generateFallbackAnalysis(item.title, keyword, item.heatScore).angles,
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
