import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config, HeaderUtils } from "coze-coding-dev-sdk";

interface GenerateRequest {
  title: string;
  snippet: string;
  contentType: "xiaohongshu" | "douyin" | "gongzhonghao";
}

const CONTENT_PROMPTS: Record<string, string> = {
  xiaohongshu: `你是一位小红书爆款笔记写手。请根据以下热点话题，生成一篇小红书风格的笔记。
要求：
- 标题：吸引眼球，带emoji，15-25字
- 正文：活泼有趣，多用emoji和感叹号，分段清晰，300-500字
- 结尾：加5-8个相关话题标签（#xxx#格式）
- 风格：闺蜜聊天感，真实分享感，有干货有情绪`,

  douyin: `你是一位抖音短视频脚本创作者。请根据以下热点话题，生成一个60秒口播脚本。
要求：
- 开头Hook（前3秒）：一句话抓住注意力，制造悬念或冲突
- 正文：口播体，短句为主，节奏感强，300-400字
- 结尾：引导互动（点赞/关注/评论），自然不生硬
- 风格：口语化、有节奏感、适合念出来`,

  gongzhonghao: `你是一位微信公众号深度文章作者。请根据以下热点话题，生成一篇公众号长文。
要求：
- 标题：引人深思，15-30字
- 导语：1-2句话点明主题，吸引阅读
- 正文：分3-4个小节，每节有小标题，有数据/案例/观点，800-1200字
- 结尾：总结观点+引发思考的提问
- 风格：专业深度、逻辑清晰、有洞察力`,
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateRequest;
    const { title, snippet, contentType } = body;

    if (!title || !contentType || !CONTENT_PROMPTS[contentType]) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const systemPrompt = CONTENT_PROMPTS[contentType];
    const userMessage = `热点话题：${title}\n\n相关信息：${snippet || "无额外信息"}\n\n请根据以上话题生成内容。`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userMessage },
    ];

    const response = await client.invoke(messages, {
      model: "doubao-seed-2-0-mini-260215",
      temperature: 0.8,
    });

    const content = response.content || "";

    if (!content) {
      return NextResponse.json({ error: "生成内容为空" }, { status: 500 });
    }

    return NextResponse.json({ content, contentType, title });
  } catch (error) {
    console.error("[Generate API] Error:", error);
    return NextResponse.json(
      { error: "内容生成失败，请稍后重试" },
      { status: 500 }
    );
  }
}
