import { NextResponse } from "next/server";

// Hot board data sources with mirrors
const HOT_SOURCES = {
  baidu: {
    name: "百度热搜",
    key: "baidu",
    urls: [
      "https://top.baidu.com/api/board?platform=wise&tab=realtime",
    ],
    parse: (data: Record<string, unknown>): HotItem[] => {
      const cards = (data.data as Record<string, unknown> | undefined)?.cards as Array<Record<string, unknown>> | undefined;
      if (!cards?.[0]) return [];
      const content = cards[0].content as Array<Record<string, unknown>> | undefined;
      if (!content?.[0]) return [];
      const items = content[0].content as Array<Record<string, unknown>> | undefined;
      if (!items) return [];
      return items.map((item, idx) => ({
        title: (item.word as string) || "",
        hot: item.hotScore as number || (50 - idx) * 1000,
        url: (item.url as string) || `https://www.baidu.com/s?wd=${encodeURIComponent(item.word as string || "")}`,
      })).filter(i => i.title);
    },
  },
  toutiao: {
    name: "头条热榜",
    key: "toutiao",
    urls: [
      "https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc",
    ],
    parse: (data: Record<string, unknown>): HotItem[] => {
      const items = data.data as Array<Record<string, unknown>> | undefined;
      if (!items) return [];
      return items.map((item, idx) => ({
        title: (item.Title as string) || "",
        hot: (item.HotValue as number) || (50 - idx) * 1000,
        url: (item.Url as string) || "",
      })).filter(i => i.title);
    },
  },
  bilibili: {
    name: "B站热搜",
    key: "bilibili",
    urls: [
      "https://s.search.bilibili.com/main/hotword",
    ],
    parse: (data: Record<string, unknown>): HotItem[] => {
      const list = data.list as Array<Record<string, unknown>> | undefined;
      if (!list) return [];
      return list.map((item, idx) => ({
        title: (item.keyword as string) || (item.show_name as string) || "",
        hot: (item.heat_score as number) || (30 - idx) * 10000,
        url: `https://search.bilibili.com/all?keyword=${encodeURIComponent((item.keyword as string) || "")}`,
      })).filter(i => i.title);
    },
  },
  weibo: {
    name: "微博热搜",
    key: "weibo",
    urls: [
      "https://weibo.com/ajax/side/hotSearch",
    ],
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Referer: "https://weibo.com/",
    },
    parse: (data: Record<string, unknown>): HotItem[] => {
      const realtime = (data.data as Record<string, unknown> | undefined)?.realtime as Array<Record<string, unknown>> | undefined;
      if (!realtime) return [];
      return realtime.map((item, idx) => ({
        title: (item.word as string) || "",
        hot: (item.num as number) || (50 - idx) * 10000,
        url: `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word as string || "")}`,
      })).filter(i => i.title);
    },
  },
  douyin: {
    name: "抖音热榜",
    key: "douyin",
    urls: [
      "https://www.iesdouyin.com/web/api/v2/hotsearch/billboard/word/",
    ],
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    },
    parse: (data: Record<string, unknown>): HotItem[] => {
      const wordList = data.word_list as Array<Record<string, unknown>> | undefined;
      if (!wordList) return [];
      return wordList.map((item, idx) => ({
        title: (item.word as string) || "",
        hot: (item.hot_value as number) || (50 - idx) * 100000,
        url: `https://www.douyin.com/search/${encodeURIComponent(item.word as string || "")}`,
      })).filter(i => i.title);
    },
  },
};

interface HotItem {
  title: string;
  hot: number;
  url: string;
}

interface HotBoard {
  key: string;
  name: string;
  items: HotItem[];
  updatedAt: number;
  error?: string;
}

// Server-side cache (10 min TTL)
let cachedBoards: HotBoard[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function fetchWithTimeout(url: string, timeoutMs = 5000, customHeaders?: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
        ...customHeaders,
      },
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchBoard(key: string, source: typeof HOT_SOURCES[keyof typeof HOT_SOURCES]): Promise<HotBoard> {
  const board: HotBoard = {
    key,
    name: source.name,
    items: [],
    updatedAt: Date.now(),
  };

  const customHeaders = "headers" in source ? source.headers : undefined;

  for (const url of source.urls) {
    try {
      const res = await fetchWithTimeout(url, 5000, customHeaders);
      if (!res.ok) continue;
      const data = await res.json() as Record<string, unknown>;
      const items = source.parse(data);
      if (items.length > 0) {
        board.items = items.slice(0, 30); // Max 30 items per board
        return board;
      }
    } catch {
      // Try next mirror
      continue;
    }
  }

  board.error = "暂时无法获取";
  return board;
}

export async function GET() {
  try {
    // Check cache
    if (cachedBoards && Date.now() - cacheTime < CACHE_TTL) {
      return NextResponse.json({ boards: cachedBoards, cached: true });
    }

    // Fetch all boards in parallel
    const entries = Object.entries(HOT_SOURCES) as [string, typeof HOT_SOURCES[keyof typeof HOT_SOURCES]][];
    const results = await Promise.allSettled(
      entries.map(([key, source]) => fetchBoard(key, source))
    );

    const boards: HotBoard[] = results
      .filter((r): r is PromiseFulfilledResult<HotBoard> => r.status === "fulfilled")
      .map(r => r.value);

    // Update cache
    cachedBoards = boards;
    cacheTime = Date.now();

    return NextResponse.json({ boards, cached: false });
  } catch (error) {
    console.error("Hotboards error:", error);
    // Return cached data if available, even if stale
    if (cachedBoards) {
      return NextResponse.json({ boards: cachedBoards, cached: true, stale: true });
    }
    return NextResponse.json({ boards: [], error: "热榜暂时不可用" });
  }
}
