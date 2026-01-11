import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Parser from 'rss-parser';
import crypto from 'crypto';
import { setGlobalDispatcher, ProxyAgent } from 'undici';
import net from 'net';
import { parseRssHubUrl } from '@/lib/rsshub';

/**
 * Auto-detect proxy server by checking common Clash ports
 */
async function detectProxy(): Promise<string | null> {
  // Check environment variables first
  const envProxy = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
  if (envProxy) {
    try {
      const url = new URL(envProxy);
      const isReachable = await checkPort(url.hostname, parseInt(url.port) || 80);
      if (isReachable) return envProxy;
    } catch {
      // Invalid URL, continue
    }
  }

  // Common Clash/Clash Verge ports to check
  const commonPorts = [7890, 7891, 7897, 7898, 10808, 10809, 1080, 789];
  const hostname = '127.0.0.1';

  for (const port of commonPorts) {
    const isReachable = await checkPort(hostname, port);
    if (isReachable) {
      console.log(`[Proxy] Auto-detected proxy on port ${port}`);
      return `http://${hostname}:${port}`;
    }
  }

  return null;
}

/**
 * Check if a port is reachable (has a listening service)
 */
function checkPort(hostname: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(500);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, hostname);
  });
}

async function createSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore if called from Server Component
          }
        },
      },
    }
  );
}

// RSS 解析器 with auto-detect proxy
let proxyAgent: ProxyAgent | undefined = undefined;
let proxyInitialized = false;

async function initProxy() {
  if (proxyInitialized) return;

  const detectedProxy = await detectProxy();
  if (detectedProxy) {
    proxyAgent = new ProxyAgent(detectedProxy);
    setGlobalDispatcher(proxyAgent);
    console.log(`[Proxy] Using proxy: ${detectedProxy}`);
  } else {
    console.log('[Proxy] No proxy detected, using direct connection');
  }
  proxyInitialized = true;
}

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en,zh-CN;q=0.9,zh;q=0.8',
    'Cache-Control': 'max-age=0',
  },
  customFields: {
    item: [
      ['author', 'author'],
    ],
  },
});

// Custom fetch function with proxy support
async function fetchWithProxy(url: string): Promise<string> {
  await initProxy();  // Ensure proxy is initialized

  const response = await fetch(url, {
    dispatcher: proxyAgent,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en,zh-CN;q=0.9,zh;q=0.8',
    },
  } as any);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.text();
}

// Generate URL hash (first 12 chars of MD5)
function generateUrlHash(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex').slice(0, 12);
}

// 验证和解析 RSS URL
async function validateRssUrl(url: string, rsshubConfig?: RssHubConfig) {
  try {
    // Resolve RssHub URL if needed
    let fetchUrl = url;
    const rsshubResult = parseRssHubUrl(url, rsshubConfig?.enabled ? { instanceUrl: rsshubConfig.url } : undefined);
    if (rsshubResult.isValid && rsshubResult.feedUrl) {
      fetchUrl = rsshubResult.feedUrl;
      console.log(`[Validate] Resolved ${url} -> ${fetchUrl}`);
    }

    // Fetch content with proxy support
    const xml = await fetchWithProxy(fetchUrl);
    // Parse the XML content
    const feed = await parser.parseString(xml);
    const itemCount = feed.items?.length || 0;
    const latestItem = feed.items?.[0];

    return {
      valid: true,
      title: feed.title || 'Untitled Feed',
      description: feed.description || '',
      siteUrl: feed.link || '',
      faviconUrl: feed.image?.url || null,
      itemCount,
      latestItemDate: latestItem?.pubDate || latestItem?.isoDate || null,
    };
  } catch (error) {
    console.error('[Validate] Error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid RSS URL',
    };
  }
}

// GET /api/feeds - 获取用户的所有 RSS 源
export async function GET() {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: feeds, error } = await supabase
      .from('feeds')
      .select(`
        *,
        category:categories(id, name, color, icon)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ feeds });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

interface ProxyConfig {
  enabled: boolean;
  autoDetect: boolean;
  host: string;
  port: string;
}

interface RssHubConfig {
  enabled: boolean;
  url: string;
}

interface FetchRequestBody {
  url: string;
  category_id?: string | null;
  title?: string;
  description?: string;
  validate_only?: boolean;
  rsshub?: RssHubConfig;
}

// POST /api/feeds - 添加新的 RSS 源
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: FetchRequestBody = await request.json();
    const { url, category_id, title: customTitle, description: customDescription, validate_only, rsshub } = body;

    if (!url) {
      return NextResponse.json({ error: 'RSS URL is required' }, { status: 400 });
    }

    // 验证 RSS URL
    const validation = await validateRssUrl(url, rsshub);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 如果只是验证，返回验证结果
    if (validate_only) {
      return NextResponse.json({
        feed: {
          title: validation.title,
          description: validation.description,
          itemCount: validation.itemCount,
          latestItemDate: validation.latestItemDate,
        }
      });
    }

    // 检查 URL 是否已存在
    const { data: existingFeed } = await supabase
      .from('feeds')
      .select('id')
      .eq('user_id', user.id)
      .eq('url', url)
      .maybeSingle();

    if (existingFeed) {
      return NextResponse.json({ error: 'RSS feed already exists' }, { status: 409 });
    }

    // 创建新的 RSS 源
    const urlHash = generateUrlHash(url);

    const { data: feed, error } = await supabase
      .from('feeds')
      .insert({
        user_id: user.id,
        category_id: category_id || null,
        title: customTitle || validation.title,
        url,
        url_hash: urlHash,
        description: customDescription || validation.description,
        site_url: validation.siteUrl,
        favicon_url: validation.faviconUrl,
        is_active: true,
      })
      .select(`
        *,
        category:categories(id, name, color, icon)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ feed }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
