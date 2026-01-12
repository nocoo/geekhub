/**
 * ArticleViewModelService Tests
 *
 * Tests the view model layer that combines database data.
 *
 * Run: bun test -- article-view-model.test.ts
 */

import { describe, it, expect } from 'bun:test';
import { ArticleViewModelService } from './article-view-model';

describe('ArticleViewModelService', () => {
  describe('constructor', () => {
    it('should initialize with Supabase client', () => {
      // Create a mock Supabase client
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
      } as any;

      const viewModel = new ArticleViewModelService(mockSupabase);
      expect(viewModel).toBeInstanceOf(ArticleViewModelService);
    });
  });

  describe('getArticlesForFeed', () => {
    it('should return result structure with empty articles', async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
      } as any;

      const viewModel = new ArticleViewModelService(mockSupabase);
      const readArticleIds = new Set<string>();

      const result = await viewModel.getArticlesForFeed(
        'feed-id',
        'Test Feed',
        'https://example.com/icon.png',
        readArticleIds
      );

      // Should return a valid result structure
      expect(result).toHaveProperty('feed');
      expect(result).toHaveProperty('articles');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('lastUpdated');
      expect(result.articles).toBeArray();
      expect(result.feed.id).toBe('feed-id');
      expect(result.feed.title).toBe('Test Feed');
    });

    it('should return empty articles when no data', async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
      } as any;

      const viewModel = new ArticleViewModelService(mockSupabase);
      const readArticleIds = new Set<string>();

      const result = await viewModel.getArticlesForFeed(
        'feed-id',
        'Test Feed',
        '',
        readArticleIds
      );

      expect(result.articles).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle articles with data', async () => {
      const mockArticles = [
        {
          id: 'article-uuid-1',
          feed_id: 'feed-123',
          title: 'Test Article',
          url: 'https://example.com/article1',
          link: 'https://example.com/article1',
          author: 'Test Author',
          published_at: new Date().toISOString(),
          content: '<p>Test content</p>',
          content_text: 'Test content',
          summary: 'Test summary',
          hash: 'abc123',
        },
      ];

      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: mockArticles, error: null }),
              }),
            }),
          }),
        }),
      } as any;

      const viewModel = new ArticleViewModelService(mockSupabase);
      const readArticleIds = new Set<string>();

      const result = await viewModel.getArticlesForFeed(
        'feed-123',
        'Test Feed',
        '',
        readArticleIds
      );

      expect(result.articles.length).toBe(1);
      expect(result.articles[0].id).toBe('article-uuid-1');
      expect(result.articles[0].title).toBe('Test Article');
      expect(result.articles[0].isRead).toBe(false);
    });

    it('should mark articles as read based on readArticleIds', async () => {
      const mockArticles = [
        {
          id: 'article-uuid-1',
          feed_id: 'feed-123',
          title: 'Test Article',
          url: 'https://example.com/article1',
          link: 'https://example.com/article1',
          author: 'Test Author',
          published_at: new Date().toISOString(),
          content: '<p>Test content</p>',
          content_text: 'Test content',
          summary: 'Test summary',
          hash: 'abc123',
        },
      ];

      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: mockArticles, error: null }),
              }),
            }),
          }),
        }),
      } as any;

      const viewModel = new ArticleViewModelService(mockSupabase);

      // Article is read
      const readArticleIds = new Set<string>(['article-uuid-1']);

      const result = await viewModel.getArticlesForFeed(
        'feed-123',
        'Test Feed',
        '',
        readArticleIds
      );

      expect(result.articles.length).toBe(1);
      expect(result.articles[0].isRead).toBe(true);
      expect(result.articles[0].id).toBe('article-uuid-1');
    });
  });

  describe('result structure', () => {
    it('should have correct feed structure in result', async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
      } as any;

      const viewModel = new ArticleViewModelService(mockSupabase);
      const readArticleIds = new Set<string>();

      const result = await viewModel.getArticlesForFeed(
        'feed-123',
        'My Feed',
        'https://example.com/favicon.ico',
        readArticleIds
      );

      expect(result.feed).toEqual({
        id: 'feed-123',
        title: 'My Feed',
        url: '',
      });
    });

    it('should have correct article structure when article exists', async () => {
      const mockArticles = [
        {
          id: 'article-uuid-1',
          feed_id: 'feed-123',
          title: 'Test Article',
          url: 'https://example.com/article1',
          link: 'https://example.com/article1',
          author: 'Test Author',
          published_at: new Date().toISOString(),
          content: '<p>Test content</p>',
          content_text: 'Test content',
          summary: 'Test summary',
          hash: 'abc123',
        },
      ];

      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: mockArticles, error: null }),
              }),
            }),
          }),
        }),
      } as any;

      const viewModel = new ArticleViewModelService(mockSupabase);
      const readArticleIds = new Set<string>();

      const result = await viewModel.getArticlesForFeed(
        'feed-123',
        'Test Feed',
        '',
        readArticleIds
      );

      // Verify the result contains articles with correct properties
      expect(result.articles.length).toBe(1);
      const article = result.articles[0];
      expect(article).toHaveProperty('id');
      expect(article).toHaveProperty('title');
      expect(article).toHaveProperty('url');
      expect(article).toHaveProperty('isRead');
      expect(article).toHaveProperty('feedId');
      expect(article).toHaveProperty('feedName');
      expect(article).toHaveProperty('hash');
      expect(article.id).toBe('article-uuid-1');
      expect(article.hash).toBe('abc123');
    });
  });
});
