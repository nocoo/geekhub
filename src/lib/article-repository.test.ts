/**
 * ArticleRepository Tests
 *
 * Tests the file system layer that reads article data.
 *
 * Run: bun test -- article-repository.test.ts
 */

import { ArticleRepository, ArticleRaw } from './article-repository';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';

// Test data directory
const TEST_DATA_DIR = join(process.cwd(), 'data', 'test');
const TEST_FEED_HASH = 'test123456789';
const TEST_FEED_DIR = join(TEST_DATA_DIR, 'feeds', TEST_FEED_HASH);
const TEST_ARTICLES_DIR = join(TEST_FEED_DIR, 'articles');

// Mock article data
const mockArticle: ArticleRaw = {
  hash: 'abc123',
  title: 'Test Article',
  url: 'https://example.com/test',
  link: 'https://example.com/test',
  author: 'Test Author',
  published_at: '2026-01-10T00:00:00Z',
  content: '<p>Test content</p>',
  content_text: 'Test content',
  summary: 'Test summary',
  categories: ['Tech', 'Test'],
  fetched_at: '2026-01-10T00:00:00Z',
};

const mockIndex = {
  last_updated: '2026-01-10T00:00:00Z',
  total_count: 1,
  articles: [
    {
      hash: 'abc123',
      title: 'Test Article',
      url: 'https://example.com/test',
      link: 'https://example.com/test',
      author: 'Test Author',
      published_at: '2026-01-10T00:00:00Z',
      summary: 'Test summary',
    },
  ],
};

describe('ArticleRepository', () => {
  let repo: ArticleRepository;

  beforeAll(async () => {
    // Create test directory structure
    await mkdir(TEST_ARTICLES_DIR, { recursive: true });

    // Write test files
    await writeFile(
      join(TEST_FEED_DIR, 'index.json'),
      JSON.stringify(mockIndex, null, 2)
    );
    await writeFile(
      join(TEST_ARTICLES_DIR, 'abc123.json'),
      JSON.stringify(mockArticle, null, 2)
    );

    repo = new ArticleRepository(TEST_DATA_DIR);
  });

  afterAll(async () => {
    // Clean up test directory
    await rm(TEST_DATA_DIR, { recursive: true, force: true });
  });

  describe('getIndex', () => {
    it('should return index data for existing feed', async () => {
      const index = await repo.getIndex(TEST_FEED_HASH);

      expect(index).not.toBeNull();
      expect(index?.total_count).toBe(1);
      expect(index?.articles).toHaveLength(1);
      expect(index?.articles[0].hash).toBe('abc123');
    });

    it('should return null for non-existent feed', async () => {
      const index = await repo.getIndex('nonexistent');
      expect(index).toBeNull();
    });
  });

  describe('getArticleHashes', () => {
    it('should return array of article hashes', async () => {
      const hashes = await repo.getArticleHashes(TEST_FEED_HASH);

      expect(hashes).toEqual(['abc123']);
    });

    it('should return empty array for non-existent feed', async () => {
      const hashes = await repo.getArticleHashes('nonexistent');
      expect(hashes).toEqual([]);
    });
  });

  describe('getArticle', () => {
    it('should return article data for existing article', async () => {
      const article = await repo.getArticle(TEST_FEED_HASH, 'abc123');

      expect(article).not.toBeNull();
      expect(article?.title).toBe('Test Article');
      expect(article?.url).toBe('https://example.com/test');
      expect(article?.author).toBe('Test Author');
      expect(article?.content).toBe('<p>Test content</p>');
    });

    it('should return null for non-existent article', async () => {
      const article = await repo.getArticle(TEST_FEED_HASH, 'nonexistent');
      expect(article).toBeNull();
    });

    it('should return null for non-existent feed', async () => {
      const article = await repo.getArticle('nonexistent', 'abc123');
      expect(article).toBeNull();
    });
  });

  describe('getArticles', () => {
    it('should return multiple articles by hashes', async () => {
      // Create another test article
      const mockArticle2: ArticleRaw = {
        ...mockArticle,
        hash: 'def456',
        title: 'Test Article 2',
      };
      await writeFile(
        join(TEST_ARTICLES_DIR, 'def456.json'),
        JSON.stringify(mockArticle2, null, 2)
      );

      const articles = await repo.getArticles(TEST_FEED_HASH, ['abc123', 'def456']);

      expect(articles).toHaveLength(2);
      expect(articles[0].hash).toBe('abc123');
      expect(articles[1].hash).toBe('def456');
    });

    it('should skip non-existent articles', async () => {
      const articles = await repo.getArticles(TEST_FEED_HASH, ['abc123', 'nonexistent']);

      expect(articles).toHaveLength(1);
      expect(articles[0].hash).toBe('abc123');
    });
  });

  describe('getAllArticles', () => {
    it('should return all articles without limit', async () => {
      const articles = await repo.getAllArticles(TEST_FEED_HASH);

      expect(articles.length).toBeGreaterThanOrEqual(1);
    });

    it('should return limited articles with limit parameter', async () => {
      // Add more articles to index
      const extendedIndex = {
        ...mockIndex,
        total_count: 3,
        articles: [
          mockIndex.articles[0],
          { ...mockIndex.articles[0], hash: 'def456' },
          { ...mockIndex.articles[0], hash: 'ghi789' },
        ],
      };
      await writeFile(
        join(TEST_FEED_DIR, 'index.json'),
        JSON.stringify(extendedIndex, null, 2)
      );

      const articles = await repo.getAllArticles(TEST_FEED_HASH, 2);

      expect(articles).toHaveLength(2);
    });
  });

  describe('feedExists', () => {
    it('should return true for existing feed', async () => {
      const exists = await repo.feedExists(TEST_FEED_HASH);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent feed', async () => {
      const exists = await repo.feedExists('nonexistent');
      expect(exists).toBe(false);
    });
  });

  describe('listFeeds', () => {
    it('should return list of feed hashes', async () => {
      const feeds = await repo.listFeeds();

      expect(feeds).toContain(TEST_FEED_HASH);
    });
  });
});
