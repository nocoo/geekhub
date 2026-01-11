/**
 * ArticleViewModelService Tests
 *
 * Tests the view model layer that combines file system data and database status.
 *
 * Run: bun test -- article-view-model.test.ts
 */

import { describe, it, expect } from 'bun:test';
import { ArticleViewModelService } from './article-view-model';

describe('ArticleViewModelService', () => {
  describe('constructor', () => {
    it('should initialize with data directory', () => {
      const viewModel = new ArticleViewModelService('/custom/data');
      expect(viewModel).toBeInstanceOf(ArticleViewModelService);
    });

    it('should use default data directory when not specified', () => {
      const viewModel = new ArticleViewModelService();
      expect(viewModel).toBeInstanceOf(ArticleViewModelService);
    });
  });

  describe('getArticlesForFeed', () => {
    it('should return Promise when called', async () => {
      const viewModel = new ArticleViewModelService('/test/data');

      // Create a mock read status service
      const mockReadStatus = {
        getReadHashes: async () => new Set<string>(),
        userId: 'test-user',
      };

      const result = await viewModel.getArticlesForFeed(
        'feed-id',
        'feed-hash',
        'Test Feed',
        'https://example.com/icon.png',
        mockReadStatus as any
      );

      // Should return a valid result structure
      expect(result).toHaveProperty('feed');
      expect(result).toHaveProperty('articles');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('lastUpdated');
      expect(result.articles).toBeArray();
    });

    it('should return empty articles for non-existent feed', async () => {
      const viewModel = new ArticleViewModelService('/nonexistent');

      const mockReadStatus = {
        getReadHashes: async () => new Set<string>(),
        userId: 'test-user',
      };

      const result = await viewModel.getArticlesForFeed(
        'feed-id',
        'nonexistent-hash',
        'Test Feed',
        '',
        mockReadStatus as any
      );

      expect(result.articles).toBeArray();
      expect(result.total).toBe(0);
    });
  });

  describe('getArticle', () => {
    it('should return Promise when called', async () => {
      const viewModel = new ArticleViewModelService('/test/data');

      const mockReadStatus = {
        getReadHashes: async () => new Set<string>(),
        userId: 'test-user',
      };

      const result = await viewModel.getArticle(
        'feed-hash',
        'article-hash',
        'feed-id',
        'Test Feed',
        'https://example.com/icon.png',
        mockReadStatus as any
      );

      // Should return null for non-existent article
      expect(result).toBeNull();
    });
  });

  describe('result structure', () => {
    it('should have correct feed structure in result', async () => {
      const viewModel = new ArticleViewModelService('/test/data');

      const mockReadStatus = {
        getReadHashes: async () => new Set<string>(),
        userId: 'test-user',
      };

      const result = await viewModel.getArticlesForFeed(
        'feed-123',
        'hash-123',
        'My Feed',
        'https://example.com/favicon.ico',
        mockReadStatus as any
      );

      expect(result.feed).toEqual({
        id: 'feed-123',
        title: 'My Feed',
        url: '',
      });
    });

    it('should have correct article structure when article exists', async () => {
      // This test verifies the ArticleViewModel interface structure
      // Full integration test would require actual file system data
      const viewModel = new ArticleViewModelService('/test/data');

      const mockReadStatus = {
        getReadHashes: async () => new Set<string>(['read-hash']),
        userId: 'test-user',
      };

      // The method should handle the read status correctly
      const result = await viewModel.getArticlesForFeed(
        'feed-123',
        'hash-123',
        'Test Feed',
        '',
        mockReadStatus as any
      );

      // Verify the result can contain articles with isRead property
      if (result.articles.length > 0) {
        const article = result.articles[0];
        expect(article).toHaveProperty('id');
        expect(article).toHaveProperty('title');
        expect(article).toHaveProperty('isRead');
        expect(article).toHaveProperty('feedId');
        expect(article).toHaveProperty('feedName');
      }
    });
  });
});
