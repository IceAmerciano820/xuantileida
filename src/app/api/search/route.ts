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
}

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
  if (name.includes("虎嗅") || link.includes("huxiu")) return "虎嗅";

  return siteName || "网络";
}

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

async function generateAngles(
  keyword: string,
  topics: Array<{ title: string; snippet: string; source: string }>
): Promise<string[][]> {
  const customHeaders = {};
  const llmConfig = new LLMConfig();
  const llmClient = new LLMClient(llmConfig, customHeaders);

  const topicsDescription = topics
    .map(
      (t, i) =>
        `${i + 1}. [${t.source}] ${t.title}\n   摘要: ${t.snippet.substring(0, 150)}`
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
    console.error("LLM angle generation failed:", error);
  }

  // Fallback: generate template-based angles
  return topics.map((t) => {
    const angles: string[] = [];
    const title = t.title.toLowerCase();

    if (title.includes("教程") || title.includes("如何") || title.includes("怎么")) {
      angles.push(`以「${keyword}新手指南」为主题，制作一篇保姆级实操教程`);
      angles.push(`拍摄一支「${keyword}避坑指南」短视频，分享常见误区`);
    } else if (title.includes("排行") || title.includes("推荐") || title.includes("测评")) {
      angles.push(`做一期「${keyword}红黑榜」对比评测内容`);
      angles.push(`以个人体验为切入点，分享「我用了X个${keyword}工具后的真实感受」`);
    } else if (title.includes("趋势") || title.includes("未来") || title.includes("预测")) {
      angles.push(`深度分析「${keyword}未来3大趋势」，结合数据做预判`);
      angles.push(`制作「${keyword}行业现状」信息图/长图内容`);
    } else {
      angles.push(`围绕「${keyword}」制作一篇观点鲜明的评论文章，表达独特看法`);
      angles.push(`以个人经历切入，分享「我和${keyword}的故事」引发共鸣`);
      angles.push(`做一期「${keyword}入门到进阶」的系列内容规划`);
    }

    return angles.slice(0, 3);
  });
}

export async function POST(request: NextRequest) {
  try {
    const { keyword, timeRange } = await request.json();

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
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    const searchConfig = new SearchConfig();
    const searchClient = new SearchClient(searchConfig, customHeaders);

    // Search multiple queries in parallel to cover different platforms
    const searchQueries = [
      `${trimmedKeyword} 热点 热门话题 最新`,
      `${trimmedKeyword} 微博 知乎 讨论`,
      `${trimmedKeyword} 抖音 小红书 爆款`,
    ];

    const searchPromises = searchQueries.map((query) =>
      searchClient.advancedSearch(query, {
        timeRange: resolvedTimeRange,
        count: 10,
        needSummary: false,
      }).catch((err: unknown) => {
        console.error(`Search failed for query: ${query}`, err);
        return { web_items: [] };
      })
    );

    const results = await Promise.all(searchPromises);

    // Merge and deduplicate results
    const seenTitles = new Set<string>();
    const allItems: Array<{
      title: string;
      source: string;
      url: string;
      snippet: string;
      heatScore: number;
      heatLevel: "high" | "medium" | "low";
      publishTime: string;
    }> = [];

    for (const result of results) {
      if (!result.web_items) continue;

      for (const item of result.web_items) {
        const normalizedTitle = (item.title || "").trim();
        if (!normalizedTitle || seenTitles.has(normalizedTitle)) continue;

        // Filter by keyword relevance
        const titleLower = normalizedTitle.toLowerCase();
        const snippetLower = (item.snippet || "").toLowerCase();
        const keywordLower = trimmedKeyword.toLowerCase();

        const isRelevant =
          titleLower.includes(keywordLower) ||
          snippetLower.includes(keywordLower) ||
          keywordLower.split("").some((char: string) => titleLower.includes(char));

        if (!isRelevant && keywordLower.length > 1) continue;

        seenTitles.add(normalizedTitle);
        const platform = inferPlatform(item.site_name || "", item.url || "");
        const heatScore = computeHeatScore(item.rank_score, item.sort_id);

        allItems.push({
          title: normalizedTitle,
          source: platform,
          url: item.url || "",
          snippet: item.snippet || "",
          heatScore,
          heatLevel: getHeatLevel(heatScore),
          publishTime: item.publish_time || "今日",
        });
      }
    }

    // Sort by heat score and take top 10
    allItems.sort((a, b) => b.heatScore - a.heatScore);
    const topItems = allItems.slice(0, 10);

    if (topItems.length === 0) {
      const timeLabels: Record<string, string> = { "6h": "近6小时", "1d": "近24小时", "7d": "近7天" };
      const timeLabel = timeLabels[resolvedTimeRange] || "近24小时";
      return NextResponse.json({
        keyword: trimmedKeyword,
        topics: [],
        message: `暂未搜到「${trimmedKeyword}」在${timeLabel}内的相关热点，试试更换其他关键词或扩大时间范围`,
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
      id: `topic-${index}`,
      title: item.title,
      source: item.source,
      url: item.url,
      snippet: item.snippet,
      heatScore: item.heatScore,
      heatLevel: item.heatLevel,
      publishTime: item.publishTime,
      angles: angles[index] || ["围绕该话题制作一篇深度分析内容", "以个人视角切入分享独特观点"],
    }));

    return NextResponse.json({
      keyword: trimmedKeyword,
      topics,
      totalFound: allItems.length,
    });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "搜索服务暂时不可用，请稍后重试" },
      { status: 500 }
    );
  }
}
