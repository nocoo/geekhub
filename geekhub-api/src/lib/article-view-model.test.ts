/**
 * ArticleViewModelService Tests
 *
 * Tests the view model layer that combines file system data and database status.
 *
 * Run: npm test -- article-view-model.test.ts
 */

import { ArticleViewModelService, ArticleViewModel, FeedViewModel } from './article-view-model';
import { ArticleRaw } from './article-repository';

// Mock dependencies
jest.mock('./article-repository');
jest.mock('./read-status-service');

import { ArticleRepository } from './article-repository';
import { ReadStatusService } from './read-status-service';

describe('ArticleViewModelService', () => {
  let viewModel: ArticleViewModelService;
  let mockRepo: jest.Mocked<ArticleRepository>;
  let mockReadStatus: jest.Mocked<ReadStatusService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock repository with proper type casting
    const repoMock = {
      getIndex: jest.fn(),
      getArticle: jest.fn(),
      getArticles: jest.fn(),
      getAllArticles: jest.fn(),
      getArticleHashes: jest.fn(),
      feedExists: jest.fn(),
      listFeeds: jest.fn(),
    };
    mockRepo = repoMock as unknown as jest.Mocked<ArticleRepository>;

    // Create mock read status service
    const readStatusMock = {
      getReadHashes: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      markAsUnread: jest.fn(),
      userId: 'test-user-id',
      createClient: jest.fn(),
    };
    mockReadStatus = readStatusMock as unknown as jest.Mocked<ReadStatusService>;

    // Mock ArticleRepository constructor
    (ArticleRepository as jest.MockedClass<typeof ArticleRepository>).mockImplementation(() => mockRepo);

    viewModel = new ArticleViewModelService('/test/data');
  });

  const mockIndex = {
    last_updated: '2026-01-10T00:00:00Z',
    total_count: 2,
    articles: [
      {
        hash: 'abc123',
        title: 'Test Article 1',
        url: 'https://example.com/1',
        author: 'Author 1',
        published_at: '2026-01-09T00:00:00Z',
        summary: 'Summary 1',
      },
      {
        hash: 'def456',
        title: 'Test Article 2',
        url: 'https://example.com/2',
        author: 'Author 2',
        published_at: '2026-01-08T00:00:00Z',
        summary: 'Summary 2',
      },
    ],
  };

  const mockArticles: ArticleRaw[] = [
    {
      hash: 'abc123',
      title: 'Test Article 1',
      url: 'https://example.com/1',
      content: '<p>Content 1 <img src="https://example.com/image1.jpg" /></p>',
      published_at: '2026-01-09T00:00:00Z',
      fetched_at: '2026-01-10T00:00:00Z',
    },
    {
      hash: 'def456',
      title: 'Test Article 2',
      url: 'https://example.com/2',
      content: '<p>Content 2 without image</p>',
      published_at: '2026-01-08T00:00:00Z',
      fetched_at: '2026-01-10T00:00:00Z',
    },
  ];

  describe('getArticlesForFeed', () => {
    it('should combine articles with read status correctly', async () => {
      // Setup mocks
      mockRepo.getIndex.mockResolvedValue(mockIndex);
      mockRepo.getArticle.mockImplementation(async (_urlHash, hash) => {
        return mockArticles.find(a => a.hash === hash) || null;
      });
      mockReadStatus.getReadHashes.mockResolvedValue(new Set(['abc123']));

      const result = await viewModel.getArticlesForFeed(
        'feed-id-123',
        'feed-hash-123',
        'Test Feed',
        'https://example.com/icon.png',
        mockReadStatus
      );

      // Verify feed info
      expect(result.feed).toEqual({
        id: 'feed-id-123',
        title: 'Test Feed',
        url: '',
      });

      // Verify articles
      expect(result.articles).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.lastUpdated).toBe('2026-01-10T00:00:00Z');

      // Verify first article (read)
      const article1 = result.articles[0];
      expect(article1.id).toBe('abc123');
      expect(article1.title).toBe('Test Article 1');
      expect(article1.isRead).toBe(true);
      expect(article1.feedId).toBe('feed-id-123');
      expect(article1.feedName).toBe('Test Feed');
      expect(article1.feedIcon).toBe('https://example.com/icon.png');
      expect(article1.image).toBe('https://example.com/image1.jpg');
      expect(article1.publishedAt).toEqual(new Date('2026-01-09T00:00:00Z'));

      // Verify second article (unread)
      const article2 = result.articles[1];
      expect(article2.id).toBe('def456');
      expect(article2.isRead).toBe(false);
      expect(article2.image).toBeNull();
    });

    it('should return empty result when index not found', async () => {
      mockRepo.getIndex.mockResolvedValue(null);

      const result = await viewModel.getArticlesForFeed(
        'feed-id-123',
        'feed-hash-123',
        'Test Feed',
        '',
        mockReadStatus
      );

      expect(result.articles).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.lastUpdated).toBeNull();
    });

    it('should handle articles without images', async () => {
      mockRepo.getIndex.mockResolvedValue(mockIndex);
      mockRepo.getArticle.mockResolvedValue({
        hash: 'abc123',
        title: 'Test Article 1',
        url: 'https://example.com/1',
        content: '<p>Content without any images</p>',
        fetched_at: '2026-01-10T00:00:00Z',
      });
      mockReadStatus.getReadHashes.mockResolvedValue(new Set());

      const result = await viewModel.getArticlesForFeed(
        'feed-id-123',
        'feed-hash-123',
        'Test Feed',
        '',
        mockReadStatus
      );

      expect(result.articles[0].image).toBeNull();
    });

    it('should extract image from article content', async () => {
      mockRepo.getIndex.mockResolvedValue(mockIndex);
      mockRepo.getArticle.mockResolvedValue({
        hash: 'abc123',
        title: 'Test Article',
        url: 'https://example.com/test',
        content: '<img src="https://example.com/photo.jpg" alt="Test" />',
        fetched_at: '2026-01-10T00:00:00Z',
      });
      mockReadStatus.getReadHashes.mockResolvedValue(new Set());

      const result = await viewModel.getArticlesForFeed(
        'feed-id-123',
        'feed-hash-123',
        'Test Feed',
        '',
        mockReadStatus
      );

      expect(result.articles[0].image).toBe('https://example.com/photo.jpg');
    });

    it('should handle errors when reading article content', async () => {
      mockRepo.getIndex.mockResolvedValue(mockIndex);
      mockRepo.getArticle.mockImplementation(async () => {
        throw new Error('File not found');
      });
      mockReadStatus.getReadHashes.mockResolvedValue(new Set());

      const result = await viewModel.getArticlesForFeed(
        'feed-id-123',
        'feed-hash-123',
        'Test Feed',
        '',
        mockReadStatus
      );

      // Should still return articles, just without image
      expect(result.articles).toHaveLength(2);
      expect(result.articles[0].image).toBeNull();
    });
  });

  describe('getArticle', () => {
    it('should return single article with read status', async () => {
      const mockArticle: ArticleRaw = {
        hash: 'abc123',
        title: 'Single Article',
        url: 'https://example.com/single',
        author: 'Author',
        published_at: '2026-01-10T00:00:00Z',
        summary: 'Summary',
        content: '<p>Content with <img src="https://example.com/img.jpg" /></p>',
        fetched_at: '2026-01-10T00:00:00Z',
      };

      mockRepo.getArticle.mockResolvedValue(mockArticle);
      mockReadStatus.getReadHashes.mockResolvedValue(new Set(['abc123']));

      const result = await viewModel.getArticle(
        'feed-hash-123',
        'abc123',
        'feed-id-123',
        'Test Feed',
        'https://example.com/icon.png',
        mockReadStatus
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe('abc123');
      expect(result?.title).toBe('Single Article');
      expect(result?.isRead).toBe(true);
      expect(result?.image).toBe('https://example.com/img.jpg');
    });

    it('should return null when article not found', async () => {
      mockRepo.getArticle.mockResolvedValue(null);
      mockReadStatus.getReadHashes.mockResolvedValue(new Set());

      const result = await viewModel.getArticle(
        'feed-hash-123',
        'nonexistent',
        'feed-id-123',
        'Test Feed',
        '',
        mockReadStatus
      );

      expect(result).toBeNull();
    });

    it('should handle article without image', async () => {
      mockRepo.getArticle.mockResolvedValue({
        hash: 'abc123',
        title: 'No Image Article',
        url: 'https://example.com/no-image',
        content: '<p>Just text content</p>',
        fetched_at: '2026-01-10T00:00:00Z',
      });
      mockReadStatus.getReadHashes.mockResolvedValue(new Set());

      const result = await viewModel.getArticle(
        'feed-hash-123',
        'abc123',
        'feed-id-123',
        'Test Feed',
        '',
        mockReadStatus
      );

      expect(result?.image).toBeNull();
    });
  });
});
