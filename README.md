# 选题雷达 (Topic Radar)

面向内容创作者的**热点选题发现工具**：输入一个赛道关键词，实时聚合全网搜索热点，用 AI 生成可直接落地的创作角度，帮助创作者快速判断"今天该写什么"。

## 功能特性

- **热点搜索**：聚合全网网页 + 社媒定向查询（微博/知乎/抖音/小红书/B站），SSE 流式返回，首屏结果秒出。
- **AI 创作角度**：LLM 为每条热点生成 3 个可落地的内容切入角度 + 热度评分理由，失败时自动 fallback 到模板角度。
- **多平台热榜**：聚合百度、头条、B站、微博、抖音五大平台实时热榜。
- **每日选题简报**：自动扫描监控关键词，生成今日选题简报，支持按日期回看。
- **监控关键词**：自定义最多 5 个关注赛道，每日自动追踪。
- **灵感库**：收藏热点、写笔记、打标签、导入导出、排期日历。
- **批量生成**：多选热点，三平台并行生成内容。
- **PWA 支持**：可安装到桌面，离线缓存静态资源。
- **深色/浅色双主题**：玻璃态仪表盘视觉风格。

## 技术栈

- **框架**：Next.js 16 (App Router) + React 19 + TypeScript 5
- **UI**：shadcn/ui (Radix UI) + Tailwind CSS 4
- **数据/AI**：`coze-coding-dev-sdk`（Web Search 全网搜索 + LLM 内容生成）
- **其他**：SSE 流式输出、Service Worker (PWA)

## 快速开始

```bash
# 安装依赖（仅支持 pnpm）
pnpm install

# 启动开发服务器（默认 http://localhost:5000，支持热更新）
pnpm dev

# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start
```

> 端口通过环境变量 `DEPLOY_RUN_PORT` 读取，默认 5000。

## 环境依赖说明

搜索与 AI 生成能力依赖沙箱环境提供的 `coze-coding-dev-sdk`（`SearchClient` / `LLMClient`，凭证通过 `HeaderUtils` 在运行时注入，代码中不包含任何密钥）。

- 在扣子/Coze 部署环境中：开箱即用。
- 在本地或其他环境 clone 运行：页面、热榜展示、主题、PWA 等前端功能正常；但 `/api/search`、`/api/generate` 等需要 SDK 凭证的接口在缺少对应环境时无法直接调用，需自行配置 SDK 访问凭证。

## 项目结构

```
src/
├── app/
│   ├── page.tsx                    # 主页（搜索表单 + 结果展示 + 三态视图）
│   ├── layout.tsx                  # 根布局（viewport / PWA 配置）
│   └── api/
│       ├── search/route.ts         # 热点搜索（SSE 流式 + LLM 角度 + 漏斗日志/去重补位）
│       ├── generate/route.ts       # AI 内容生成
│       ├── trend-compare/route.ts  # 趋势对比
│       └── hotboards/route.ts      # 五平台热榜聚合
├── components/
│   ├── ui/                         # shadcn/ui 基础组件
│   ├── landing-view.tsx            # 首屏（今日热点速览 + 赛道探索）
│   ├── radar-landing-page.tsx      # 雷达扫描着陆动画
│   ├── daily-briefing.tsx          # 每日选题简报
│   ├── hotboards-section.tsx       # 多平台热榜
│   ├── result-card.tsx             # 热点结果卡片
│   ├── batch-generate-modal.tsx    # 批量生成
│   ├── favorites-modal.tsx         # 灵感库
│   └── ...
├── hooks/
│   ├── use-theme.tsx               # 深色/浅色主题
│   └── use-pwa-install.ts          # PWA 安装引导
└── lib/utils.ts                    # 工具函数 (cn)

public/
├── manifest.json                   # PWA 清单
├── sw.js                           # Service Worker
└── icons/                          # 应用图标
```

## 开发规范

- 包管理器**仅使用 pnpm**，禁止 npm / yarn。
- UI 组件默认使用 `src/components/ui/` 下的 shadcn/ui。
- TypeScript 严格模式，禁止隐式 `any`。
- 服务端端口从 `process.env.DEPLOY_RUN_PORT` 读取，禁止硬编码。

更多工程与设计规范见 `AGENTS.md` 与 `DESIGN.md`。
