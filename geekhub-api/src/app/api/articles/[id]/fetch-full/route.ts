import { NextRequest, NextResponse } from 'next/server';
import { ProxyAgent } from 'undici';
import * as cheerio from 'cheerio';

// Configure proxy
let proxyAgent: ProxyAgent | undefined;

async function initProxy() {
  if (proxyAgent) return;

  const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
  if (proxyUrl) {
    proxyAgent = new ProxyAgent(proxyUrl);
  }
}

// Custom fetch with proxy
async function fetchWithProxy(url: string): Promise<string> {
  await initProxy();

  const response = await fetch(url, {
    dispatcher: proxyAgent,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  } as any);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.text();
}

/**
 * Extract article content from various sources
 */
async function extractFullContent(url: string): Promise<{ content: string; title?: string }> {
  const html = await fetchWithProxy(url);
  const $ = cheerio.load(html);

  // WeChat Article (mp.weixin.qq.com)
  if (url.includes('mp.weixin.qq.com')) {
    const content = $('#js_content').html() || '';
    const title = $('#activity-name').text().trim() ||
                 $('meta[property="og:title"]').attr('content') || '';
    return { content: content.trim(), title };
  }

  // Generic article extraction - try common content selectors
  const contentSelectors = [
    'article',
    '[role="article"]',
    '.post-content',
    '.entry-content',
    '.article-content',
    '.content',
    '#content',
    'main',
  ];

  for (const selector of contentSelectors) {
    const element = $(selector);
    if (element.length && element.text().length > 200) {
      // Remove unwanted elements
      element.find('script, style, nav, aside, footer, .comments, .share-buttons').remove();
      return { content: element.html() || '' };
    }
  }

  // Fallback: get body content
  $('script, style, nav, aside, footer, header').remove();
  return { content: $('body').html() || '' };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    console.log(`[FetchFull] Fetching full content for article ${id} from ${url}`);

    const { content, title } = await extractFullContent(url);

    if (!content) {
      return NextResponse.json({ error: 'Failed to extract content' }, { status: 500 });
    }

    console.log(`[FetchFull] Successfully fetched ${content.length} characters`);

    return NextResponse.json({
      success: true,
      content,
      title,
    });
  } catch (error) {
    console.error('[FetchFull] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
