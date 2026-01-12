import Parser from 'rss-parser';
import crypto from 'crypto';
import { FeedLogger } from './logger';
import { setGlobalDispatcher, ProxyAgent } from 'undici';
import net from 'net';
import { parseRssHubUrl } from './rsshub';
import { createClient } from '@supabase/supabase-js';

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

export interface ProxyConfig {
  enabled: boolean;
  autoDetect: boolean;
  host: string;
  port: string;
}

export interface RssHubConfig {
  enabled: boolean;
  url: string;
}

export interface FeedInfo {
  id: string;
  url: string;
  url_hash: string;
  title: string;
  description?: string;
  site_url?: string;
  favicon_url?: string;
  fetch_interval_minutes?: number;
}

export interface FetchResult {
  success: boolean;
  articlesFound: number;
  articlesNew: number;
  articlesUpdated: number;
  duration: string;
  error?: string;
}

export interface ArticleData {
  hash: string;
  title: string;
  url: string;
  link?: string;
  author?: string;
  published_at?: string;
  updated_at?: string;
  content?: string;
  content_text?: string;
  summary?: string;
  tags?: string[];
  categories?: string[];
  enclosures?: Array<{
    url: string;
    type?: string;
    length?: number;
  }>;
  fetched_at: string;
}

// Configure proxy with auto-detection
let proxyAgent: ProxyAgent | undefined = undefined;
let proxyInitialized = false;
let customProxyConfig: ProxyConfig | undefined = undefined;
let customRssHubConfig: RssHubConfig | undefined = undefined;

export function setProxyConfig(config?: ProxyConfig) {
  customProxyConfig = config;
  proxyInitialized = false; // Force re-initialization
  proxyAgent = undefined;
}

export function setRssHubConfig(config?: RssHubConfig) {
  customRssHubConfig = config;
}

async function initProxy() {
  if (proxyInitialized) return;

  let proxyUrl: string | null = null;

  // Use custom proxy config if provided and enabled
  if (customProxyConfig?.enabled) {
    if (customProxyConfig.autoDetect) {
      proxyUrl = await detectProxy();
    } else {
      proxyUrl = `http://${customProxyConfig.host}:${customProxyConfig.port}`;
    }
  } else {
    // Fall back to environment variable detection
    proxyUrl = await detectProxy();
  }

  if (proxyUrl) {
    proxyAgent = new ProxyAgent(proxyUrl);
    setGlobalDispatcher(proxyAgent);
    console.log(`[Proxy] Using proxy: ${proxyUrl}`);
  } else {
    console.log('[Proxy] No proxy detected, using direct connection');
  }
  proxyInitialized = true;
}

function createParser(): Parser {
  const options: any = {
    timeout: 10000,
    customFields: {
      item: [
        ['dc:creator', 'creator'],
        ['content:encoded', 'content'],
        ['author', 'author'],
      ],
    },
  };

  return new Parser(options);
}

const parser = createParser();

// Custom fetch function with proxy support
async function fetchWithProxy(url: string): Promise<string> {
  await initProxy();  // Ensure proxy is initialized

  // Resolve RssHub URL if needed
  let fetchUrl = url;
  const rsshubConfig = customRssHubConfig?.enabled ? customRssHubConfig : undefined;
  const rsshubResult = parseRssHubUrl(url, rsshubConfig ? { instanceUrl: rsshubConfig.url } : undefined);
  if (rsshubResult.isValid && rsshubResult.feedUrl) {
    fetchUrl = rsshubResult.feedUrl;
    console.log(`[RssHub] Resolved ${url} -> ${fetchUrl}`);
  }

  const response = await fetch(fetchUrl, {
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

/**
 * Supabase client for database operations
 */
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export class FeedFetcher {
  private logger: FeedLogger;

  constructor(
    private feed: FeedInfo,
    private dataDir: string = process.cwd(), // Still needed for FeedLogger
    proxyConfig?: ProxyConfig,
    rsshubConfig?: RssHubConfig
  ) {
    // Initialize logger with feedId and urlHash
    this.logger = new FeedLogger(this.feed.id, this.feed.url_hash, this.dataDir);

    // Set proxy and RssHub config for this fetcher
    setProxyConfig(proxyConfig);
    setRssHubConfig(rsshubConfig);
  }

  private generateArticleHash(article: Parser.Item): string {
    const content = `${article.link || article.guid || ''}|${article.title || ''}|${article.pubDate || ''}`;
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Check if an article already exists in the database
   */
  private async articleExists(hash: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('articles')
      .select('id')
      .eq('feed_id', this.feed.id)
      .eq('hash', hash)
      .maybeSingle();

    return !error && !!data;
  }

  /**
   * Save an article to the database
   */
  private async saveArticle(article: Parser.Item, hash: string): Promise<void> {
    const supabase = getSupabaseClient();
    const item = article as Parser.Item & { creator?: string; 'content:encoded'?: string };

    const articleData = {
      feed_id: this.feed.id,
      hash,
      title: article.title || 'Untitled',
      url: article.link || article.guid || '',
      link: article.link || undefined,
      author: item.creator || undefined,
      published_at: article.pubDate || article.isoDate || null,
      content: item['content:encoded'] || article.content || undefined,
      content_text: article.contentSnippet || undefined,
      summary: article.contentSnippet || undefined,
      categories: article.categories?.map((c: unknown) => typeof c === 'string' ? c : String(c)) || [],
      tags: article.categories?.map((c: unknown) => typeof c === 'string' ? c : String(c)) || [],
      fetched_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('articles').insert(articleData);
    if (error) {
      console.error('Failed to save article:', error);
      throw error;
    }
  }

  /**
   * Update fetch_status after fetch
   */
  private async updateFeedCache(result: FetchResult): Promise<void> {
    const supabase = getSupabaseClient();
    const now = new Date();
    const nextFetchAt = new Date(now.getTime() + (this.feed.fetch_interval_minutes || 60) * 60 * 1000);

    // Get current total articles count
    const { count: totalArticles } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('feed_id', this.feed.id);

    const cacheData = {
      last_fetch_at: now.toISOString(),
      last_success_at: result.success ? now.toISOString() : null,
      last_fetch_status: result.success ? 'success' : 'error',
      last_fetch_error: result.error || null,
      last_fetch_duration_ms: parseInt(result.duration) || 0,
      total_articles: totalArticles || 0,
      // unread_count is calculated based on user_articles, not updated here
      next_fetch_at: nextFetchAt.toISOString(),
    };

    await supabase
      .from('fetch_status')
      .upsert({ feed_id: this.feed.id, ...cacheData }, { onConflict: 'feed_id' });
  }

  /**
   * Record fetch history
   */
  private async recordFetchHistory(result: FetchResult): Promise<void> {
    const supabase = getSupabaseClient();

    const historyData = {
      feed_id: this.feed.id,
      fetched_at: new Date().toISOString(),
      status: result.success ? 'success' : 'error',
      duration_ms: parseInt(result.duration) || 0,
      articles_found: result.articlesFound,
      articles_new: result.articlesNew,
      error_message: result.error || null,
    };

    await supabase.from('fetch_history').insert(historyData);
  }

  async fetch(): Promise<FetchResult> {
    const startTime = Date.now();

    try {
      await this.logger.info('FETCH', this.feed.url, `Starting fetch for "${this.feed.title}"`);

      // Fetch content with proxy support
      const xml = await fetchWithProxy(this.feed.url);
      // Parse the XML content
      const feed = await parser.parseString(xml);
      const items = feed.items || [];

      await this.logger.success(200, 'PARSE', `${items.length} items`, '0ms', `Parsed RSS feed`);

      let articlesNew = 0;
      const articlesUpdated = 0;

      for (const item of items) {
        if (!item.title && !item.link) continue;

        const hash = this.generateArticleHash(item);

        const exists = await this.articleExists(hash);
        if (!exists) {
          // New article - save to database
          await this.saveArticle(item, hash);
          articlesNew++;
          await this.logger.success(200, 'NEW', item.title || 'Untitled', '0ms', `Hash: ${hash.slice(0, 8)}...`);
        }
      }

      const duration = `${Date.now() - startTime}ms`;

      await this.logger.success(200, 'DONE', this.feed.url, duration, `Found: ${items.length}, New: ${articlesNew}`);

      const result: FetchResult = {
        success: true,
        articlesFound: items.length,
        articlesNew,
        articlesUpdated,
        duration,
      };

      // Update fetch_status and record history
      await this.updateFeedCache(result);
      await this.recordFetchHistory(result);

      return result;

    } catch (error) {
      const duration = `${Date.now() - startTime}ms`;
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.logger.error('FETCH', this.feed.url, errorMessage);

      const result: FetchResult = {
        success: false,
        articlesFound: 0,
        articlesNew: 0,
        articlesUpdated: 0,
        duration,
        error: errorMessage,
      };

      // Still update fetch_status and record history on error
      await this.updateFeedCache(result);
      await this.recordFetchHistory(result);

      return result;
    }
  }

  async getLogs(): Promise<string[]> {
    const logs = await this.logger.getRecentLogs(100);
    return logs.map(log => {
      const timestamp = new Date(log.timestamp).toISOString().slice(0, 19).replace('T', ' ');
      const duration = log.duration_ms ? `(${log.duration_ms}ms)` : '';
      return `[${timestamp}] ${log.level} [${log.status || ''}] ${log.action} ${log.url} ${duration} - ${log.message || ''}`;
    });
  }

  getFeedInfo(): FeedInfo {
    return this.feed;
  }
}
