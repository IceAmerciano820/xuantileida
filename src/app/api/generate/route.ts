import { NextRequest, NextResponse } from "next/server";
import { LLMClient, Config, HeaderUtils } from "coze-coding-dev-sdk";

interface GenerateRequest {
  prompt?: string;
  title?: string;
  snippet?: string;
  contentType?: string;
}

const CONTENT_PROMPTS: Record<string, string> = {
  xiaohongshu: `你是一位真实的小红书用户，喜欢分享自己的使用体验和发现。不是品牌运营号，不是AI写手。

【绝对禁止】
- 开头用"在当今""随着""近年来""在这个…的时代"等宏大叙事铺垫
- 使用"赋能、助力、打造、构建、深度、全方位、多维度、显著、无缝、直观、强大、革命性"等AI高频词
- 使用"保姆级教程""绝绝子""谁懂啊""闭眼入""YYDS""救命！我真的会谢"等被用烂的爆款腔
- "家人们""宝子们""姐妹们"开头堆砌称呼（全文最多自然出现一次）
- 每行都挂emoji，emoji泛滥
- "不仅仅是…更是…""不仅…而且…"否定式排比
- "高效、便捷、智能"式三段排比堆砌
- 结尾升华、展望、"让我们一起XX"

【写作要求】
- 标题：口语化，带具体信息（数字/反差/真实疑问），15-25字，最多1个emoji
- 正文：像跟朋友聊天一样分享真实体验。第一句直接说场景或结论，不要铺垫背景
- 有具体细节：什么场景下用的、花了多少钱、具体怎么操作、踩了什么坑、效果到底怎样
- 长短句交错，允许短句独立成段。禁止每句都是20字以上的匀速长句
- emoji克制：全文最多3-5个，自然穿插
- 结尾说完就停，不要升华不要号召
- 标签8-12个，混合大词和长尾词，不要全是流量大词
- 300-500字`,

  douyin: `你是一位抖音短视频创作者，擅长写口播脚本。你的脚本像真人在镜头前说话，不像念稿。

【绝对禁止】
- 开头用"在当今""随着""近年来"等铺垫
- 使用"赋能、助力、打造、构建、深度、全方位、多维度、显著、无缝、直观、强大、革命性"等AI高频词
- "大家好今天给大家分享""家人们谁懂啊"式假嗨开场
- "不仅仅是…更是…"否定式排比
- "首先/其次/最后"的机械结构
- 结尾"记得点赞关注哦"式生硬引导
- 每句都是20字以上的匀速长句

【写作要求】
- 前3秒Hook：一个问题、一个反差、一个具体画面，直接抓人。例如"我花了3000块测了10款XX，结果最贵的反而最难用"
- 句子短，口语化，适合念出来。写完自己念一遍，拗口的就改
- 有个人观点和态度，敢说"我觉得不行""这个真没必要"
- 节奏感强：短句+停顿+转折，像真的在说话
- 结尾引导自然："你们觉得呢""评论区聊聊""有同款经历的扣1"
- 300-400字`,

  gongzhonghao: `你是一位微信公众号作者，写东西有个人观点，不写百科词条。

【绝对禁止】
- 开头用"在当今XX快速发展的时代""随着XX的兴起/普及""近年来"等套话
- 使用"赋能、助力、打造、构建、深度探讨、全方位、多维度、显著、持续优化、无缝、直观、强大、革命性、颠覆性、前景广阔、未来可期、让我们拭目以待"等AI高频词
- "众所周知""毋庸置疑""不可否认"等说教开头
- "不仅仅是…更是…""不仅…而且…"否定式排比
- "首先/其次/最后"的机械结构
- "小编"自称
- "今天就跟大家聊到这里"式主持腔结尾
- 结尾升华、展望、"让我们一起XX"

【写作要求】
- 观点文：开头直接抛观点或讲一个具体故事，1-2段内让读者知道你要说什么
- 干货文：先给结论再展开，段落短（每段不超过4行），每段一个意思
- 有个人判断和经验之谈："我个人觉得""从我自己的经验来看""这事儿其实没那么简单"
- 用具体数字、具体案例、具体场景替代"极大提升""效果显著"这类空形容
- 长短句交错，允许一句话独立成段
- 结尾说完就停，可以抛一个问题引发思考，但不要升华展望
- 800-1200字`,
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateRequest;

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    let systemPrompt: string;
    let userMessage: string;

    // P2-4/P2-5: Support direct prompt mode (title candidates, tags, custom options)
    if (body.prompt) {
      systemPrompt = "你是一位真实的内容创作者，不是AI写手。写作要求：开头直接说具体的事，不铺垫背景；长短句交错，允许短句独立成段；用具体数字和场景替代空形容；有个人观点和立场；禁止使用\"赋能、助力、打造、构建、深度、全方位、多维度、显著、无缝、直观、强大、革命性、颠覆性\"等AI高频词；禁止\"在当今\"\"随着\"\"近年来\"\"众所周知\"等套话开头；结尾说完就停，不升华不展望。直接输出内容，不要添加额外说明或前言。";
      userMessage = body.prompt;
    } else if (body.title && body.contentType && CONTENT_PROMPTS[body.contentType]) {
      // Legacy mode for backward compatibility
      systemPrompt = CONTENT_PROMPTS[body.contentType];
      userMessage = `热点话题：${body.title}\n\n相关信息：${body.snippet || "无额外信息"}\n\n请根据以上话题生成内容。`;
    } else {
      return NextResponse.json({ error: "参数无效：需要 prompt 或 title+contentType" }, { status: 400 });
    }

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

    return NextResponse.json({ content });
  } catch (error) {
    console.error("[Generate API] Error:", error);
    return NextResponse.json(
      { error: "内容生成失败，请稍后重试" },
      { status: 500 }
    );
  }
}
