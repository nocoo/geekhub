import { NextRequest, NextResponse } from 'next/server';
import { ProxyAgent } from 'undici';

let proxyAgent: ProxyAgent | undefined;

async function initProxy() {
  if (proxyAgent) return;

  const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
  if (proxyUrl) {
    proxyAgent = new ProxyAgent(proxyUrl);
  }
}

interface ImageProxyRequest {
  url: string;
  referer?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ImageProxyRequest = await request.json();
    const { url, referer } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    await initProxy();

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    };

    // Add referer if provided
    if (referer) {
      headers['Referer'] = referer;
    }

    const response = await fetch(url, {
      dispatcher: proxyAgent,
      headers,
    } as any);

    if (!response.ok) {
      return NextResponse.json(
        { error: `HTTP ${response.status}: ${response.statusText}` },
        { status: response.status }
      );
    }

    // Get image buffer
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Return image with proper headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('[ImageProxy] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch image' },
      { status: 500 }
    );
  }
}
