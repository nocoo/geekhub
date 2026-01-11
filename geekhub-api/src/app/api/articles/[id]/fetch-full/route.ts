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
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en,zh-CN;q=0.9,zh;q=0.8',
    },
  } as any);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.text();
}

/**
 * Extract article content using improved selectors
 */
async function extractFullContent(url: string): Promise<{ content: string; title?: string }> {
  const html = await fetchWithProxy(url);
  const $ = cheerio.load(html);

  // WeChat Article (mp.weixin.qq.com) - special handling
  if (url.includes('mp.weixin.qq.com')) {
    const content = $('#js_content').html() || '';
    const title = $('#activity-name').text().trim() ||
                 $('meta[property="og:title"]').attr('content') || '';
    return { content: content.trim(), title };
  }

  // Remove unwanted elements first
  $('script, style, nav, aside, footer, header, .comments, .share-buttons, .sidebar, .ad, .advertisement').remove();

  // Try content selectors in order of priority
  const contentSelectors = [
    'article',
    '[role="article"]',
    '.post-content',
    '.entry-content',
    '.article-content',
    '.post-body',
    '.entry-body',
    '.content',
    '#content',
    '.post',
    '.article',
    'main',
  ];

  for (const selector of contentSelectors) {
    const element = $(selector);
    if (element.length > 0) {
      const text = element.text().trim();
      // Check if it has meaningful content (more than 200 chars and not just navigation)
      if (text.length > 200 && !text.includes('Skip to content')) {
        return { content: element.html() || '' };
      }
    }
  }

  // Fallback: try to find the div with most text content
  let bestElement: any = null;
  let maxLength = 0;

  $('div, p, section').each(function() {
    const $this = $(this);
    const text = $this.text().trim();
    // Skip if too short or contains too many links (likely navigation)
    if (text.length > 300 && text.length > maxLength && $this.find('a').length < 20) {
      maxLength = text.length;
      bestElement = $this;
    }
  });

  if (bestElement && bestElement.length > 0) {
    return { content: bestElement.html() || '' };
  }

  // Last resort: body content
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

    console.log(`[FetchFull] Successfully fetched ${content.length} chars`);

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
