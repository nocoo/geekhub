import Parser from 'rss-parser';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { FeedLogger } from './logger';
import { setGlobalDispatcher, ProxyAgent } from 'undici';
import net from 'net';

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

export class FeedFetcher {
  private logger: FeedLogger;
  private feedDir: string;
  private articlesDir: string;
  private indexFile: string;
  private cacheFile: string;

  constructor(
    private feed: FeedInfo,
    private dataDir: string = path.join(process.cwd(), 'data')
  ) {
    this.feedDir = path.join(this.dataDir, 'feeds', this.feed.url_hash);
    this.articlesDir = path.join(this.feedDir, 'articles');
    this.indexFile = path.join(this.feedDir, 'index.json');
    this.cacheFile = path.join(this.feedDir, 'cache.json');
    this.logger = new FeedLogger(this.feed.url_hash, this.dataDir);
  }

  private generateArticleHash(article: Parser.Item): string {
    const content = `${article.link || article.guid || ''}|${article.title || ''}|${article.pubDate || ''}`;
    return crypto.createHash('md5').update(content).digest('hex');
  }

  private async ensureDirs(): Promise<void> {
    await fs.mkdir(this.articlesDir, { recursive: true });
  }

  private async getArticlePath(hash: string): Promise<string> {
    await fs.mkdir(this.articlesDir, { recursive: true });
    return path.join(this.articlesDir, `${hash}.json`);
  }

  private articleExists(hash: string): Promise<boolean> {
    return fs.access(path.join(this.articlesDir, hash + '.json'))
      .then(() => true)
      .catch(() => false);
  }

  private async saveArticle(article: Parser.Item, hash: string): Promise<void> {
    const articlePath = await this.getArticlePath(hash);
    const item = article as Parser.Item & { creator?: string; 'content:encoded'?: string };

    const articleData: ArticleData = {
      hash,
      title: article.title || 'Untitled',
      url: article.link || article.guid || '',
      link: article.link,
      author: item.creator || undefined,
      published_at: article.pubDate || article.isoDate || undefined,
      content: item['content:encoded'] || article.content || undefined,
      content_text: article.contentSnippet || undefined,
      summary: article.contentSnippet || undefined,
      categories: article.categories?.map((c: unknown) => typeof c === 'string' ? c : String(c)),
      enclosures: article.enclosure ? [{
        url: article.enclosure.url || '',
        type: article.enclosure.type,
        length: article.enclosure.length,
      }] : undefined,
      fetched_at: new Date().toISOString(),
    };

    await fs.writeFile(articlePath, JSON.stringify(articleData, null, 2), 'utf-8');
  }

  private async updateIndex(newArticles: ArticleData[]): Promise<void> {
    let index: { last_updated: string; total_count: number; articles: Array<ArticleData> } = {
      last_updated: new Date().toISOString(),
      total_count: 0,
      articles: [],
    };

    try {
      const content = await fs.readFile(this.indexFile, 'utf-8');
      index = JSON.parse(content);
    } catch {
      // Create new index
    }

    // Add new articles to the beginning
    index.articles = [...newArticles, ...index.articles];
    // Keep only the latest 1000 articles
    index.articles = index.articles.slice(0, 1000);
    index.total_count = index.articles.length;
    index.last_updated = new Date().toISOString();

    await fs.writeFile(this.indexFile, JSON.stringify(index, null, 2), 'utf-8');
  }

  private async updateCache(result: FetchResult): Promise<void> {
    const cache = {
      last_fetch: new Date().toISOString(),
      status: result.success ? 'success' : 'error',
      error: result.error || null,
      fetch_duration_ms: result.duration,
      articles_found: result.articlesFound,
      articles_new: result.articlesNew,
      next_fetch: new Date(Date.now() + (this.feed.fetch_interval_minutes || 60) * 60 * 1000).toISOString(),
    };

    await fs.writeFile(this.cacheFile, JSON.stringify(cache, null, 2), 'utf-8');
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
      const newArticlesData: ArticleData[] = [];

      for (const item of items) {
        if (!item.title && !item.link) continue;

        const hash = this.generateArticleHash(item);
        const articlePath = await this.getArticlePath(hash);

        try {
          await fs.access(articlePath);
          // Article exists
        } catch {
          // New article
          await this.saveArticle(item, hash);

          const articleData: ArticleData = {
            hash,
            title: item.title || 'Untitled',
            url: item.link || item.guid || '',
            link: item.link,
            author: item.creator || item.author || undefined,
            published_at: item.pubDate || item.isoDate || undefined,
            summary: item.contentSnippet || undefined,
            categories: item.categories?.map(c => typeof c === 'string' ? c : String(c)),
            fetched_at: new Date().toISOString(),
          };
          newArticlesData.push(articleData);

          articlesNew++;
          await this.logger.success(200, 'NEW', item.title || 'Untitled', '0ms', `Hash: ${hash.slice(0, 8)}...`);
        }
      }

      // Update index if there are new articles
      if (newArticlesData.length > 0) {
        await this.updateIndex(newArticlesData);
        await this.logger.success(200, 'INDEX', `Updated index with ${newArticlesData.length} new articles`, '0ms');
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

      await this.updateCache(result);

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

      await this.updateCache(result);

      return result;
    }
  }

  async getLogs(): Promise<string[]> {
    return this.logger.getRecentLogs(100);
  }

  getFeedInfo(): FeedInfo {
    return this.feed;
  }
}
