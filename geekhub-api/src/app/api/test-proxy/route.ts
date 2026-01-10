import { NextRequest, NextResponse } from 'next/server';
import { setGlobalDispatcher, ProxyAgent } from 'undici';

export async function POST(request: NextRequest) {
  try {
    const { host, port } = await request.json();

    if (!host || !port) {
      return NextResponse.json(
        { success: false, error: 'Missing host or port' },
        { status: 400 }
      );
    }

    // Create a test proxy agent
    const proxyUrl = `http://${host}:${port}`;
    const proxyAgent = new ProxyAgent(proxyUrl);
    setGlobalDispatcher(proxyAgent);

    // Test the proxy by making a request to a reliable endpoint
    const testUrl = 'https://httpbin.org/ip';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(testUrl, {
        dispatcher: proxyAgent,
        signal: controller.signal,
      } as any);

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          success: true,
          message: 'Proxy is working',
          proxyUrl,
          origin: data.origin,
        });
      } else {
        return NextResponse.json({
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        });
      }
    } catch (abortError: any) {
      clearTimeout(timeoutId);
      if (abortError.name === 'AbortError') {
        return NextResponse.json({
          success: false,
          error: 'Connection timeout (5s)',
        });
      }
      throw abortError;
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
    });
  }
}
