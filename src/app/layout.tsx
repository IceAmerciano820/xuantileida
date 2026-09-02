import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#0B0F1A',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: '选题雷达 - 内容创作者的热点选题工具',
  description:
    '输入关键词，雷达扫描全网热点内容，为内容创作者提供选题灵感和切入角度建议。聚合微博、知乎、抖音、小红书等多平台热点数据。',
  keywords: [
    '选题雷达',
    '选题工具',
    '内容创作',
    '自媒体工具',
    '热搜',
    '热点话题',
    '创作灵感',
  ],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '选题雷达',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {children}
      </body>
    </html>
  );
}
