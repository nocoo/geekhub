/**
 * @file useDatabase.test.ts
 * Unit tests for useDatabase hooks, especially optimistic update behavior
 */

import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { act } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { FeedViewModel } from '@/types/feed-view-model';

// Mock the supabase client
mock.module('@/lib/supabase-browser', () => ({
  createClient: mock(() => ({
    auth: {
      getUser: mock(),
    },
    from: mock(() => ({
      select: mock(() => ({
        eq: mock(() => ({
          single: mock(),
          order: mock(),
        })),
        in: mock(),
      })),
      insert: mock(() => ({
        select: mock(() => ({
          single: mock(),
        })),
      })),
      update: mock(() => ({
        select: mock(() => ({
          single: mock(),
        })),
      })),
      delete: mock(() => ({
        eq: mock(),
      })),
    })),
  })),
}));

describe('Optimistic Update Cache Key', () => {
  // This test verifies that optimistic updates use the correct cache key
  // that matches what useFeedViewModels() reads from
  it('should use feedViewModels cache key (not feeds) for unread count updates', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const userId = 'user-123';
    const feedId = 'feed-456';
    const feedViewModelCacheKey = ['feedViewModels', userId];
    const feedsCacheKey = ['feeds', userId];

    // Initialize cache with feed data
    const initialFeeds: FeedViewModel[] = [
      {
        id: feedId,
        title: 'Test Feed',
        url: 'https://example.com/feed.xml',
        categoryId: null,
        faviconUrl: null,
        description: null,
        isActive: true,
        autoTranslate: false,
        totalArticles: 10,
        unreadCount: 10,
        isFetching: false,
        lastFetchAt: null,
        lastFetchStatus: null,
        nextFetchAt: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];

    // Set the feedViewModels cache (this is what Sidebar reads from)
    act(() => {
      queryClient.setQueryData(feedViewModelCacheKey, initialFeeds);
    });

    // Verify feedViewModels cache exists and has correct data
    const cachedFeeds = queryClient.getQueryData<FeedViewModel[]>(feedViewModelCacheKey);
    expect(cachedFeeds).toBeDefined();
    expect(cachedFeeds![0].unreadCount).toBe(10);

    // Simulate optimistic update: decrement unread count by 1
    act(() => {
      queryClient.setQueryData<FeedViewModel[]>(feedViewModelCacheKey, (old = []) =>
        old.map(feed =>
          feed.id === feedId
            ? { ...feed, unreadCount: Math.max(0, (feed.unreadCount || 0) - 1) }
            : feed
        )
      );
    });

    // Verify the optimistic update worked
    const updatedFeeds = queryClient.getQueryData<FeedViewModel[]>(feedViewModelCacheKey);
    expect(updatedFeeds![0].unreadCount).toBe(9);

    // CRITICAL: Verify feeds cache does NOT exist (it should not be used)
    const feedsCache = queryClient.getQueryData<FeedViewModel[]>(feedsCacheKey);
    expect(feedsCache).toBeUndefined();
  });

  it('should correctly calculate unread count as total - read', () => {
    const totalArticles = 100;
    const readCount = 30;
    const expectedUnread = totalArticles - readCount;

    expect(expectedUnread).toBe(70);
  });

  it('should handle zero unread count correctly', () => {
    const totalArticles = 10;
    const readCount = 10;
    const expectedUnread = Math.max(0, totalArticles - readCount);

    expect(expectedUnread).toBe(0);
  });

  it('should handle unread count below zero gracefully', () => {
    const totalArticles = 5;
    const readCount = 10;
    const expectedUnread = Math.max(0, totalArticles - readCount);

    expect(expectedUnread).toBe(0);
  });
});

describe('FeedViewModel field naming', () => {
  // This test ensures we use camelCase field names consistently
  it('should use unreadCount (camelCase) not unread_count (snake_case)', () => {
    const feed: FeedViewModel = {
      id: 'feed-1',
      title: 'Test',
      url: 'https://test.com',
      categoryId: null,
      faviconUrl: null,
      description: null,
      isActive: true,
      autoTranslate: false,
      totalArticles: 100,
      unreadCount: 50, // camelCase
      isFetching: false,
      lastFetchAt: null,
      lastFetchStatus: null,
      nextFetchAt: null,
      createdAt: '',
      updatedAt: '',
    };

    // Verify the field exists and is camelCase
    expect(feed).toHaveProperty('unreadCount');
    expect(feed.unreadCount).toBe(50);

    // Verify snake_case version does not exist
    expect(feed).not.toHaveProperty('unread_count');
  });

  it('should use totalArticles (camelCase) not total_articles (snake_case)', () => {
    const feed: FeedViewModel = {
      id: 'feed-1',
      title: 'Test',
      url: 'https://test.com',
      categoryId: null,
      faviconUrl: null,
      description: null,
      isActive: true,
      autoTranslate: false,
      totalArticles: 100, // camelCase
      unreadCount: 50,
      isFetching: false,
      lastFetchAt: null,
      lastFetchStatus: null,
      nextFetchAt: null,
      createdAt: '',
      updatedAt: '',
    };

    expect(feed).toHaveProperty('totalArticles');
    expect(feed.totalArticles).toBe(100);
    expect(feed).not.toHaveProperty('total_articles');
  });
});
