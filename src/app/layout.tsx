import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: '热点灵感采集 - 内容创作者选题工具',
  description:
    '输入关键词，自动搜索全网热点内容，为内容创作者提供选题灵感和切入角度建议。聚合微博、知乎、抖音、小红书等多平台热点数据。',
  keywords: [
    '热点采集',
    '选题工具',
    '内容创作',
    '自媒体工具',
    '热搜',
    '热点话题',
    '创作灵感',
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
