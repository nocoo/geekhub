/**
 * @file useFeedViewModels.test.ts
 * Unit tests for FeedViewModel transformation and grouping logic
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { FeedViewModel, FeedGroupViewModel, CategoryViewModel } from '@/types/feed-view-model';

// Import the actual transformation function from source to ensure consistency
import { transformToViewModel } from '@/lib/view-models/feed-view-model';

// Test the transformation logic from API response to ViewModel
describe('FeedViewModel transformation', () => {
  // Define API response type to match the actual API structure
  interface FeedApiResponse {
    id: string;
    user_id: string;
    title: string;
    url: string;
    url_hash?: string;
    category_id: string | null;
    favicon_url: string | null;
    description: string | null;
    is_active: boolean;
    fetch_interval_minutes: number;
    auto_translate: boolean;
    unread_count: number;
    total_articles: number;
    last_fetch_at: string | null;
    last_fetch_status: string | null;
    next_fetch_at: string | null;
    created_at: string;
    updated_at: string;
    category?: {
      id: string;
      user_id: string;
      name: string;
      icon: string;
      color: string;
      sort_order: number;
      created_at: string;
      updated_at: string;
    };
  }

  const mockFeed: FeedApiResponse = {
    id: 'feed-123',
    user_id: 'user-456',
    title: 'Test Feed',
    url: 'https://example.com/feed.xml',
    url_hash: 'abc123',
    category_id: 'cat-1',
    favicon_url: 'https://example.com/favicon.ico',
    description: 'A test feed description',
    is_active: true,
    fetch_interval_minutes: 15,
    auto_translate: true,
    unread_count: 10,
    total_articles: 100,
    last_fetch_at: '2026-01-12T10:00:00Z',
    last_fetch_status: 'success',
    next_fetch_at: '2026-01-12T10:15:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-12T10:00:00Z',
    category: {
      id: 'cat-1',
      user_id: 'user-456',
      name: 'Technology',
      icon: '💻',
      color: '#3b82f6',
      sort_order: 0,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  };

  it('should transform basic feed properties', () => {
    const viewModel = transformToViewModel(mockFeed);

    expect(viewModel.id).toBe('feed-123');
    expect(viewModel.title).toBe('Test Feed');
    expect(viewModel.url).toBe('https://example.com/feed.xml');
    expect(viewModel.urlHash).toBe('abc123');
  });

  it('should transform category properties', () => {
    const viewModel = transformToViewModel(mockFeed);

    expect(viewModel.categoryId).toBe('cat-1');
    expect(viewModel.categoryName).toBe('Technology');
    expect(viewModel.categoryIcon).toBe('💻');
    expect(viewModel.categoryColor).toBe('#3b82f6');
  });

  it('should handle null category', () => {
    const feedWithoutCategory = { ...mockFeed, category: undefined, category_id: null };
    const viewModel = transformToViewModel(feedWithoutCategory);

    expect(viewModel.categoryId).toBeNull();
    expect(viewModel.categoryName).toBeUndefined();
    expect(viewModel.categoryIcon).toBeUndefined();
    expect(viewModel.categoryColor).toBeUndefined();
  });

  it('should transform counts correctly', () => {
    const viewModel = transformToViewModel(mockFeed);

    expect(viewModel.unreadCount).toBe(10);
    expect(viewModel.totalArticles).toBe(100);
  });

  it('should transform status fields', () => {
    const viewModel = transformToViewModel(mockFeed);

    expect(viewModel.lastFetchAt).toBe('2026-01-12T10:00:00Z');
    expect(viewModel.lastFetchStatus).toBe('success');
    expect(viewModel.nextFetchAt).toBe('2026-01-12T10:15:00Z');
  });

  it('should handle null status fields', () => {
    const feedWithoutStatus = {
      ...mockFeed,
      last_fetch_at: null,
      last_fetch_status: null,
      next_fetch_at: null,
    };
    const viewModel = transformToViewModel(feedWithoutStatus);

    expect(viewModel.lastFetchAt).toBeNull();
    expect(viewModel.lastFetchStatus).toBeNull();
    expect(viewModel.nextFetchAt).toBeNull();
  });

  it('should set isFetching to false by default', () => {
    const viewModel = transformToViewModel(mockFeed);
    expect(viewModel.isFetching).toBe(false);
  });

  // CRITICAL: Verify all snake_case to camelCase field mappings
  // This test ensures no fields are missed during transformation
  it('should correctly map all snake_case API fields to camelCase ViewModel fields', () => {
    const apiFeed: FeedApiResponse = {
      id: 'test-id',
      user_id: 'user-id',
      title: 'Test Feed',
      url: 'https://example.com/feed.xml',
      url_hash: 'hash123',
      category_id: 'cat-id',
      favicon_url: 'https://example.com/favicon.ico',
      description: 'Description',
      is_active: true,
      fetch_interval_minutes: 30,
      auto_translate: true,
      unread_count: 5,
      total_articles: 50,
      last_fetch_at: '2026-01-12T10:00:00Z',
      last_fetch_status: 'success',
      next_fetch_at: '2026-01-12T10:30:00Z',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-12T09:00:00Z',
      category: {
        id: 'cat-id',
        user_id: 'user-id',
        name: 'Test Category',
        icon: '📁',
        color: '#ff0000',
        sort_order: 1,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    };

    const viewModel = transformToViewModel(apiFeed);

    // Verify all snake_case → camelCase mappings
    expect(viewModel.id).toBe(apiFeed.id);
    expect(viewModel.title).toBe(apiFeed.title);
    expect(viewModel.url).toBe(apiFeed.url);
    expect(viewModel.urlHash).toBe(apiFeed.url_hash);
    expect(viewModel.categoryId).toBe(apiFeed.category_id);
    expect(viewModel.faviconUrl).toBe(apiFeed.favicon_url);
    expect(viewModel.description).toBe(apiFeed.description);
    expect(viewModel.isActive).toBe(apiFeed.is_active);
    expect(viewModel.autoTranslate).toBe(apiFeed.auto_translate);
    expect(viewModel.totalArticles).toBe(apiFeed.total_articles);
    expect(viewModel.unreadCount).toBe(apiFeed.unread_count);
    expect(viewModel.lastFetchAt).toBe(apiFeed.last_fetch_at);
    expect(viewModel.lastFetchStatus).toBe(apiFeed.last_fetch_status);
    expect(viewModel.nextFetchAt).toBe(apiFeed.next_fetch_at);
    expect(viewModel.createdAt).toBe(apiFeed.created_at);
    expect(viewModel.updatedAt).toBe(apiFeed.updated_at);

    // Verify category mappings
    expect(viewModel.categoryName).toBe(apiFeed.category?.name);
    expect(viewModel.categoryIcon).toBe(apiFeed.category?.icon);
    expect(viewModel.categoryColor).toBe(apiFeed.category?.color);
  });

  it('should map zero counts correctly', () => {
    const emptyFeed: FeedApiResponse = {
      id: 'empty-feed',
      user_id: 'user-id',
      title: 'Empty Feed',
      url: 'https://empty.com/feed.xml',
      category_id: null,
      favicon_url: null,
      description: null,
      is_active: true,
      fetch_interval_minutes: 60,
      auto_translate: false,
      unread_count: 0,
      total_articles: 0,
      last_fetch_at: null,
      last_fetch_status: null,
      next_fetch_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    const viewModel = transformToViewModel(emptyFeed);

    expect(viewModel.unreadCount).toBe(0);
    expect(viewModel.totalArticles).toBe(0);
    expect(viewModel.categoryId).toBeNull();
  });
});

describe('FeedGroupViewModel calculation', () => {
  interface MockFeedViewModel {
    id: string;
    title: string;
    categoryId: string | null;
    categoryName?: string;
    categoryIcon?: string;
    categoryColor?: string;
    unreadCount: number;
    isFetching?: boolean;
  }

  function groupFeeds(feeds: MockFeedViewModel[]): FeedGroupViewModel[] {
    const grouped = new Map<string, MockFeedViewModel[]>();
    const uncategorized: MockFeedViewModel[] = [];

    for (const feed of feeds) {
      if (feed.categoryId) {
        const group = grouped.get(feed.categoryId) || [];
        group.push(feed);
        grouped.set(feed.categoryId, group);
      } else {
        uncategorized.push(feed);
      }
    }

    const groups: FeedGroupViewModel[] = [];

    // Process categorized feeds
    for (const [categoryId, categoryFeeds] of grouped) {
      const firstFeed = categoryFeeds[0];
      const category: CategoryViewModel = {
        id: categoryId,
        name: firstFeed.categoryName || 'Unknown',
        icon: firstFeed.categoryIcon || '📁',
        color: firstFeed.categoryColor || '#6b7280',
        sortOrder: 0,
        feedCount: categoryFeeds.length,
        unreadCount: categoryFeeds.reduce((sum, f) => sum + f.unreadCount, 0),
      };
      groups.push({
        category,
        feeds: categoryFeeds as unknown as FeedViewModel[],
        totalUnreadCount: category.unreadCount || 0,
      });
    }

    // Add uncategorized group
    if (uncategorized.length > 0) {
      groups.push({
        category: null,
        feeds: uncategorized as unknown as FeedViewModel[],
        totalUnreadCount: uncategorized.reduce((sum, f) => sum + f.unreadCount, 0),
      });
    }

    return groups;
  }

  const mockFeeds: MockFeedViewModel[] = [
    { id: 'feed-1', title: 'Tech Feed 1', categoryId: 'cat-tech', categoryName: 'Technology', categoryIcon: '💻', categoryColor: '#3b82f6', unreadCount: 5 },
    { id: 'feed-2', title: 'Tech Feed 2', categoryId: 'cat-tech', categoryName: 'Technology', categoryIcon: '💻', categoryColor: '#3b82f6', unreadCount: 3 },
    { id: 'feed-3', title: 'News Feed', categoryId: 'cat-news', categoryName: 'News', categoryIcon: '📰', categoryColor: '#ef4444', unreadCount: 10 },
    { id: 'feed-4', title: 'Uncategorized', categoryId: null, unreadCount: 2 },
  ];

  it('should group feeds by category', () => {
    const groups = groupFeeds(mockFeeds);

    expect(groups).toHaveLength(3); // tech, news, uncategorized

    const techGroup = groups.find(g => g.category?.id === 'cat-tech');
    expect(techGroup).toBeDefined();
    expect(techGroup!.feeds).toHaveLength(2);

    const newsGroup = groups.find(g => g.category?.id === 'cat-news');
    expect(newsGroup).toBeDefined();
    expect(newsGroup!.feeds).toHaveLength(1);

    const uncategorizedGroup = groups.find(g => g.category === null);
    expect(uncategorizedGroup).toBeDefined();
    expect(uncategorizedGroup!.feeds).toHaveLength(1);
  });

  it('should calculate total unread counts correctly', () => {
    const groups = groupFeeds(mockFeeds);

    const techGroup = groups.find(g => g.category?.id === 'cat-tech');
    expect(techGroup!.totalUnreadCount).toBe(8); // 5 + 3

    const newsGroup = groups.find(g => g.category?.id === 'cat-news');
    expect(newsGroup!.totalUnreadCount).toBe(10);

    const uncategorizedGroup = groups.find(g => g.category === null);
    expect(uncategorizedGroup!.totalUnreadCount).toBe(2);
  });

  it('should calculate grand total unread correctly', () => {
    const groups = groupFeeds(mockFeeds);
    const grandTotal = groups.reduce((sum, group) => sum + group.totalUnreadCount, 0);

    expect(grandTotal).toBe(20); // 5 + 3 + 10 + 2
  });

  it('should handle empty feeds array', () => {
    const groups = groupFeeds([]);
    expect(groups).toHaveLength(0);
  });

  it('should handle all uncategorized feeds', () => {
    const uncategorizedFeeds = mockFeeds.filter(f => f.categoryId === null);
    const groups = groupFeeds(uncategorizedFeeds);

    expect(groups).toHaveLength(1);
    expect(groups[0].category).toBeNull();
    expect(groups[0].feeds).toHaveLength(1);
    expect(groups[0].totalUnreadCount).toBe(2);
  });

  it('should handle all categorized feeds', () => {
    const categorizedFeeds = mockFeeds.filter(f => f.categoryId !== null);
    const groups = groupFeeds(categorizedFeeds);

    expect(groups).toHaveLength(2); // tech and news
    expect(groups.every(g => g.category !== null)).toBe(true);
  });
});

describe('FeedViewModel type validation', () => {
  it('should have correct structure for required fields', () => {
    const feed: FeedViewModel = {
      id: 'test-id',
      title: 'Test Title',
      url: 'https://example.com/feed.xml',
      urlHash: 'hash123',
      categoryId: 'cat-1',
      categoryName: 'Category',
      categoryIcon: '📁',
      categoryColor: '#000000',
      faviconUrl: 'https://example.com/favicon.ico',
      description: 'Description',
      isActive: true,
      autoTranslate: false,
      totalArticles: 100,
      unreadCount: 10,
      isFetching: false,
      lastFetchAt: null,
      lastFetchStatus: null,
      nextFetchAt: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    expect(feed.id).toBe('test-id');
    expect(feed.title).toBe('Test Title');
    expect(feed.unreadCount).toBe(10);
    expect(feed.totalArticles).toBe(100);
    expect(feed.isFetching).toBe(false);
  });

  it('should allow optional fields to be undefined', () => {
    const feed: FeedViewModel = {
      id: 'test-id',
      title: 'Test Title',
      url: 'https://example.com/feed.xml',
      categoryId: null,
      faviconUrl: null,
      description: null,
      isActive: true,
      autoTranslate: false,
      totalArticles: 0,
      unreadCount: 0,
      isFetching: false,
      lastFetchAt: null,
      lastFetchStatus: null,
      nextFetchAt: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    expect(feed.categoryId).toBeNull();
    expect(feed.faviconUrl).toBeNull();
    expect(feed.description).toBeNull();
  });
});
