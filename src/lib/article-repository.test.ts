/**
 * ArticleRepository Tests
 *
 * Tests the database layer for article storage.
 *
 * Run: bun test -- article-repository.test.ts
 */

import { describe, it, expect } from 'bun:test';
import { ArticleRepository } from './article-repository';

// Mock Supabase client
const createMockSupabase = () => {
  return {
    from: (table: string) => {
      return {
        select: (columns?: string) => ({
          eq: (column: string, value: any) => ({
            order: (column: string, options?: { ascending: boolean }) => ({
              limit: (count: number) => Promise.resolve({ data: [], error: null }),
            }),
            in: (column: string, values: any[]) => ({
              order: (column: string, options?: { ascending: boolean }) => Promise.resolve({ data: [], error: null }),
            }),
            single: () => Promise.resolve({ data: null, error: null }),
          }),
          in: (column: string, values: any[]) => ({
            order: (column: string, options?: { ascending: boolean }) => Promise.resolve({ data: [], error: null }),
          }),
        }),
        insert: (rows: any) => Promise.resolve({ data: null, error: null }),
        upsert: (rows: any, options?: any) => Promise.resolve({ error: null }),
        update: (updates: any) => ({
          eq: (column: string, value: any) => Promise.resolve({ error: null }),
        }),
        delete: () => ({
          eq: (column: string, value: any) => Promise.resolve({ error: null }),
        }),
      };
    },
  };
};

describe('ArticleRepository', () => {
  describe('constructor', () => {
    it('should initialize with Supabase client', () => {
      const mockSupabase = createMockSupabase();
      const repo = new ArticleRepository(mockSupabase as any);
      expect(repo).toBeInstanceOf(ArticleRepository);
    });
  });

  describe('getIndex', () => {
    it('should return index structure for existing feed', async () => {
      const mockSupabase = createMockSupabase();

      // Mock the articles query
      (mockSupabase as any).from = (table: string) => {
        if (table === 'articles') {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => Promise.resolve({
                    data: [
                      {
                        id: 'article-1',
                        hash: 'abc123',
                        title: 'Test Article 1',
                        url: 'https://example.com/1',
                        link: 'https://example.com/1',
                        author: 'Author 1',
                        published_at: '2024-01-01T00:00:00Z',
                        summary: 'Summary 1',
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return { select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }) };
      };

      const repo = new ArticleRepository(mockSupabase as any);
      const index = await repo.getIndex('feed-123');

      expect(index).not.toBeNull();
      expect(index).toHaveProperty('last_updated');
      expect(index).toHaveProperty('total_count');
      expect(index).toHaveProperty('articles');
      expect(Array.isArray(index?.articles)).toBe(true);
    });

    it('should return null for non-existent feed', async () => {
      const mockSupabase = createMockSupabase();

      // Mock empty result with error to simulate non-existent feed
      (mockSupabase as any).from = () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [], error: { message: 'not found' } }),
            }),
          }),
        }),
      });

      const repo = new ArticleRepository(mockSupabase as any);
      const index = await repo.getIndex('nonexistent');

      expect(index).toBeNull();
    });
  });

  describe('getArticleHashes', () => {
    it('should return array of article hashes', async () => {
      const mockSupabase = createMockSupabase();

      (mockSupabase as any).from = () => ({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({
              data: [
                { hash: 'hash1' },
                { hash: 'hash2' },
              ],
              error: null,
            }),
          }),
        }),
      });

      const repo = new ArticleRepository(mockSupabase as any);
      const hashes = await repo.getArticleHashes('feed-123');

      expect(Array.isArray(hashes)).toBe(true);
      expect(hashes.length).toBe(2);
    });

    it('should return empty array for non-existent feed', async () => {
      const mockSupabase = createMockSupabase();

      (mockSupabase as any).from = () => ({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      });

      const repo = new ArticleRepository(mockSupabase as any);
      const hashes = await repo.getArticleHashes('nonexistent');

      expect(hashes).toEqual([]);
    });
  });

  describe('getArticle', () => {
    it('should return article data for existing article', async () => {
      const mockSupabase = createMockSupabase();

      const mockArticle = {
        id: 'article-1',
        feed_id: 'feed-123',
        hash: 'abc123',
        title: 'Test Article',
        url: 'https://example.com/article',
        link: 'https://example.com/article',
        author: 'Test Author',
        published_at: '2024-01-01T00:00:00Z',
        content: '<p>Test content</p>',
        content_text: 'Test content',
        summary: 'Test summary',
      };

      (mockSupabase as any).from = () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: mockArticle, error: null }),
          }),
        }),
      });

      const repo = new ArticleRepository(mockSupabase as any);
      const article = await repo.getArticle('article-1');

      expect(article).not.toBeNull();
      expect(article?.id).toBe('article-1');
      expect(article?.title).toBe('Test Article');
    });

    it('should return null for non-existent article', async () => {
      const mockSupabase = createMockSupabase();

      (mockSupabase as any).from = () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      });

      const repo = new ArticleRepository(mockSupabase as any);
      const article = await repo.getArticle('nonexistent');

      expect(article).toBeNull();
    });
  });

  describe('getArticles', () => {
    it('should return multiple articles by hashes', async () => {
      const mockSupabase = createMockSupabase();

      const mockArticles = [
        { id: '1', hash: 'hash1', title: 'Article 1', url: 'https://example.com/1', link: 'https://example.com/1', author: 'Author 1', published_at: '2024-01-01T00:00:00Z', summary: 'Summary 1' },
        { id: '2', hash: 'hash2', title: 'Article 2', url: 'https://example.com/2', link: 'https://example.com/2', author: 'Author 2', published_at: '2024-01-02T00:00:00Z', summary: 'Summary 2' },
      ];

      (mockSupabase as any).from = () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              in: () => Promise.resolve({ data: mockArticles, error: null }),
            }),
            in: () => Promise.resolve({ data: mockArticles, error: null }),
          }),
        }),
      });

      const repo = new ArticleRepository(mockSupabase as any);
      const articles = await repo.getArticles('feed-123', ['hash1', 'hash2']);

      expect(articles.length).toBe(2);
    });

    it('should return empty array for non-existent articles', async () => {
      const mockSupabase = createMockSupabase();

      (mockSupabase as any).from = () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              in: () => Promise.resolve({ data: [], error: null }),
            }),
            in: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      });

      const repo = new ArticleRepository(mockSupabase as any);
      const articles = await repo.getArticles('feed-123', ['nonexistent']);

      expect(articles).toEqual([]);
    });
  });

  describe('getAllArticles', () => {
    it('should return all articles without limit', async () => {
      const mockSupabase = createMockSupabase();

      const mockArticles = [
        { id: '1', hash: 'hash1', title: 'Article 1', url: 'https://example.com/1', link: 'https://example.com/1', author: 'Author 1', published_at: '2024-01-01T00:00:00Z', summary: 'Summary 1' },
      ];

      (mockSupabase as any).from = () => ({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: mockArticles, error: null }),
          }),
        }),
      });

      const repo = new ArticleRepository(mockSupabase as any);
      const articles = await repo.getAllArticles('feed-123');

      expect(articles.length).toBe(1);
    });

    it('should return limited articles with limit parameter', async () => {
      const mockSupabase = createMockSupabase();

      const mockArticles = [
        { id: '1', hash: 'hash1', title: 'Article 1', url: 'https://example.com/1', link: 'https://example.com/1', author: 'Author 1', published_at: '2024-01-01T00:00:00Z', summary: 'Summary 1' },
      ];

      (mockSupabase as any).from = () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: mockArticles, error: null }),
            }),
          }),
        }),
      });

      const repo = new ArticleRepository(mockSupabase as any);
      const articles = await repo.getAllArticles('feed-123', 10);

      expect(articles.length).toBe(1);
    });

    it('should return empty array on error', async () => {
      const mockSupabase = createMockSupabase();

      (mockSupabase as any).from = () => ({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: null, error: { message: 'Error' } }),
          }),
        }),
      });

      const repo = new ArticleRepository(mockSupabase as any);
      const articles = await repo.getAllArticles('feed-123');

      expect(articles).toEqual([]);
    });
  });

  describe('getArticleByHash', () => {
    it('should return article by hash', async () => {
      const mockSupabase = createMockSupabase();
      const mockArticle = {
        id: 'article-1',
        hash: 'abc123',
        title: 'Test Article',
        url: 'https://example.com/article',
        content: '<p>Content</p>',
      };

      (mockSupabase as any).from = () => ({
        select: () => ({
          eq: (col: string) => ({
            eq: () => ({
              single: () => Promise.resolve({ data: mockArticle, error: null }),
            }),
          }),
        }),
      });

      const repo = new ArticleRepository(mockSupabase as any);
      const article = await repo.getArticleByHash('feed-123', 'abc123');

      expect(article).not.toBeNull();
      expect(article?.hash).toBe('abc123');
    });

    it('should return null when article not found', async () => {
      const mockSupabase = createMockSupabase();

      (mockSupabase as any).from = () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }),
            }),
          }),
        }),
      });

      const repo = new ArticleRepository(mockSupabase as any);
      const article = await repo.getArticleByHash('feed-123', 'nonexistent');

      expect(article).toBeNull();
    });
  });

  describe('getArticlesByIds', () => {
    it('should return multiple articles by IDs', async () => {
      const mockSupabase = createMockSupabase();
      const mockArticles = [
        { id: '1', hash: 'hash1', title: 'Article 1' },
        { id: '2', hash: 'hash2', title: 'Article 2' },
      ];

      (mockSupabase as any).from = () => ({
        select: () => ({
          in: () => Promise.resolve({ data: mockArticles, error: null }),
        }),
      });

      const repo = new ArticleRepository(mockSupabase as any);
      const articles = await repo.getArticlesByIds(['1', '2']);

      expect(articles.length).toBe(2);
      expect(articles[0].id).toBe('1');
      expect(articles[1].id).toBe('2');
    });

    it('should return empty array for empty input', async () => {
      const mockSupabase = createMockSupabase();
      const repo = new ArticleRepository(mockSupabase as any);
      const articles = await repo.getArticlesByIds([]);

      expect(articles).toEqual([]);
    });

    it('should return empty array on error', async () => {
      const mockSupabase = createMockSupabase();

      (mockSupabase as any).from = () => ({
        select: () => ({
          in: () => Promise.resolve({ data: null, error: { message: 'Error' } }),
        }),
      });

      const repo = new ArticleRepository(mockSupabase as any);
      const articles = await repo.getArticlesByIds(['1', '2']);

      expect(articles).toEqual([]);
    });
  });

  describe('feedHasArticles', () => {
    it('should return true when feed has articles', async () => {
      const mockSupabase = createMockSupabase();

      (mockSupabase as any).from = () => ({
        select: () => ({
          eq: () => ({
            limit: () => Promise.resolve({ count: 5, error: null }),
          }),
        }),
      });

      const repo = new ArticleRepository(mockSupabase as any);
      const hasArticles = await repo.feedHasArticles('feed-123');

      expect(hasArticles).toBe(true);
    });

    it('should return false when feed has no articles', async () => {
      const mockSupabase = createMockSupabase();

      (mockSupabase as any).from = () => ({
        select: () => ({
          eq: () => ({
            limit: () => Promise.resolve({ count: 0, error: null }),
          }),
        }),
      });

      const repo = new ArticleRepository(mockSupabase as any);
      const hasArticles = await repo.feedHasArticles('feed-123');

      expect(hasArticles).toBe(false);
    });

    it('should return false on error', async () => {
      const mockSupabase = createMockSupabase();

      (mockSupabase as any).from = () => ({
        select: () => ({
          eq: () => ({
            limit: () => Promise.resolve({ count: null, error: { message: 'Error' } }),
          }),
        }),
      });

      const repo = new ArticleRepository(mockSupabase as any);
      const hasArticles = await repo.feedHasArticles('feed-123');

      expect(hasArticles).toBe(false);
    });
  });

  describe('getArticles empty hashes', () => {
    it('should return empty array for empty hashes input', async () => {
      const mockSupabase = createMockSupabase();
      const repo = new ArticleRepository(mockSupabase as any);
      const articles = await repo.getArticles('feed-123', []);

      expect(articles).toEqual([]);
    });
  });

  describe('getArticleHashes error handling', () => {
    it('should return empty array on error', async () => {
      const mockSupabase = createMockSupabase();

      (mockSupabase as any).from = () => ({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: null, error: { message: 'Error' } }),
          }),
        }),
      });

      const repo = new ArticleRepository(mockSupabase as any);
      const hashes = await repo.getArticleHashes('feed-123');

      expect(hashes).toEqual([]);
    });
  });

  describe('getArticles error handling', () => {
    it('should return empty array on query error', async () => {
      const mockSupabase = createMockSupabase();

      (mockSupabase as any).from = () => ({
        select: () => ({
          eq: () => ({
            in: () => Promise.resolve({ data: null, error: { message: 'Error' } }),
          }),
        }),
      });

      const repo = new ArticleRepository(mockSupabase as any);
      const articles = await repo.getArticles('feed-123', ['hash1']);

      expect(articles).toEqual([]);
    });
  });
});
