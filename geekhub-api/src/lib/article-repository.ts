import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

/**
 * Raw article data from file system
 */
export interface ArticleRaw {
  hash: string;
  title: string;
  url: string;
  link?: string;
  author?: string;
  published_at?: string;
  content?: string;
  content_text?: string;
  summary?: string;
  categories?: string[];
  tags?: string[];
  enclosures?: Array<{
    url: string;
    type?: string;
    length?: number;
  }>;
  fetched_at: string;
}

/**
 * Article index from index.json
 */
export interface ArticleIndex {
  last_updated: string;
  total_count: number;
  articles: Array<{
    hash: string;
    title: string;
    url: string;
    link?: string;
    author?: string;
    published_at?: string;
    summary?: string;
    file_path?: string;
  }>;
}

/**
 * Repository for article file system operations
 */
export class ArticleRepository {
  private feedsDir: string;

  constructor(dataDir: string = join(process.cwd(), 'data')) {
    this.feedsDir = join(dataDir, 'feeds');
  }

  /**
   * Get article index for a feed
   */
  async getIndex(urlHash: string): Promise<ArticleIndex | null> {
    try {
      const feedDir = join(this.feedsDir, urlHash);
      const indexFile = join(feedDir, 'index.json');
      const content = await readFile(indexFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Get all article hashes from a feed's index
   */
  async getArticleHashes(urlHash: string): Promise<string[]> {
    const index = await this.getIndex(urlHash);
    return index?.articles.map(a => a.hash) || [];
  }

  /**
   * Get a single article by hash from a feed
   */
  async getArticle(urlHash: string, hash: string): Promise<ArticleRaw | null> {
    try {
      const feedDir = join(this.feedsDir, urlHash);
      const articlesDir = join(feedDir, 'articles');
      const articleFile = join(articlesDir, `${hash}.json`);
      const content = await readFile(articleFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Get multiple articles by their hashes
   */
  async getArticles(urlHash: string, hashes: string[]): Promise<ArticleRaw[]> {
    const articles: ArticleRaw[] = [];

    for (const hash of hashes) {
      const article = await this.getArticle(urlHash, hash);
      if (article) {
        articles.push(article);
      }
    }

    return articles;
  }

  /**
   * Get all articles for a feed (with optional limit)
   */
  async getAllArticles(urlHash: string, limit?: number): Promise<ArticleRaw[]> {
    const hashes = await this.getArticleHashes(urlHash);
    const limitedHashes = limit ? hashes.slice(0, limit) : hashes;
    return this.getArticles(urlHash, limitedHashes);
  }

  /**
   * Check if a feed directory exists
   */
  async feedExists(urlHash: string): Promise<boolean> {
    try {
      const feedDir = join(this.feedsDir, urlHash);
      await readdir(feedDir);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all feed hashes
   */
  async listFeeds(): Promise<string[]> {
    try {
      return await readdir(this.feedsDir);
    } catch {
      return [];
    }
  }
}
