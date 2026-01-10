import Parser from 'rss-parser';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { FeedLogger } from './logger';

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

const parser = new Parser({
  timeout: 10000,
  customFields: {
    item: [
      ['dc:creator', 'creator'],
      ['content:encoded', 'content'],
      ['author', 'author'],
    ],
  },
});

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
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const monthDir = path.join(this.articlesDir, year, month);
    await fs.mkdir(monthDir, { recursive: true });
    return path.join(monthDir, `${hash}.json`);
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

      const feed = await parser.parseURL(this.feed.url);
      const items = feed.items || [];

      await this.logger.success(200, 'PARSE', `${items.length} items`, '0ms', `Parsed RSS feed`);

      let articlesNew = 0;
      let articlesUpdated = 0;
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
