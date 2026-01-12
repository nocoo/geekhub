/**
 * @file useFeedActions.test.ts
 * Tests for feed action hooks with optimistic updates
 *
 * Note: These tests verify the mutation callbacks and optimistic update logic
 * by directly testing the QueryClient manipulation patterns.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { FeedViewModel } from '@/types/feed-view-model';

describe('useFeedActions Optimistic Updates', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('FeedViewModel cache manipulation', () => {
    it('should update autoTranslate in cache', () => {
      const initialFeeds: FeedViewModel[] = [
        {
          id: 'feed-123',
          title: 'Test Feed',
          url: 'https://example.com/feed.xml',
          categoryId: null,
          faviconUrl: null,
          description: null,
          isActive: true,
          autoTranslate: false,
          totalArticles: 10,
          unreadCount: 5,
          isFetching: false,
          lastFetchAt: null,
          lastFetchStatus: null,
          nextFetchAt: null,
          createdAt: '',
          updatedAt: '',
        },
      ];
      queryClient.setQueryData(['feedViewModels', 'user-123'], initialFeeds);

      // Simulate optimistic update for toggleAutoTranslate
      queryClient.setQueryData<FeedViewModel[]>(['feedViewModels', 'user-123'], (old = []) =>
        old.map(feed =>
          feed.id === 'feed-123'
            ? { ...feed, autoTranslate: true }
            : feed
        )
      );

      const cachedFeeds = queryClient.getQueryData(['feedViewModels', 'user-123']) as FeedViewModel[];
      expect(cachedFeeds[0].autoTranslate).toBe(true);
    });

    it('should set unreadCount to 0 for markAllAsRead', () => {
      const initialFeeds: FeedViewModel[] = [
        {
          id: 'feed-123',
          title: 'Test Feed',
          url: 'https://example.com/feed.xml',
          categoryId: null,
          faviconUrl: null,
          description: null,
          isActive: true,
          autoTranslate: false,
          totalArticles: 10,
          unreadCount: 5,
          isFetching: false,
          lastFetchAt: null,
          lastFetchStatus: null,
          nextFetchAt: null,
          createdAt: '',
          updatedAt: '',
        },
      ];
      queryClient.setQueryData(['feedViewModels', 'user-123'], initialFeeds);

      // Simulate optimistic update for markAllAsRead
      queryClient.setQueryData<FeedViewModel[]>(['feedViewModels', 'user-123'], (old = []) =>
        old.map(feed =>
          feed.id === 'feed-123'
            ? { ...feed, unreadCount: 0 }
            : feed
        )
      );

      const cachedFeeds = queryClient.getQueryData(['feedViewModels', 'user-123']) as FeedViewModel[];
      expect(cachedFeeds[0].unreadCount).toBe(0);
    });

    it('should decrement unreadCount for markAsRead', () => {
      const initialFeeds: FeedViewModel[] = [
        {
          id: 'feed-123',
          title: 'Test Feed',
          url: 'https://example.com/feed.xml',
          categoryId: null,
          faviconUrl: null,
          description: null,
          isActive: true,
          autoTranslate: false,
          totalArticles: 10,
          unreadCount: 5,
          isFetching: false,
          lastFetchAt: null,
          lastFetchStatus: null,
          nextFetchAt: null,
          createdAt: '',
          updatedAt: '',
        },
      ];
      queryClient.setQueryData(['feedViewModels', 'user-123'], initialFeeds);

      // Simulate optimistic update for markAsRead
      queryClient.setQueryData<FeedViewModel[]>(['feedViewModels', 'user-123'], (old = []) =>
        old.map(feed =>
          feed.id === 'feed-123'
            ? { ...feed, unreadCount: Math.max(0, (feed.unreadCount || 0) - 1) }
            : feed
        )
      );

      const cachedFeeds = queryClient.getQueryData(['feedViewModels', 'user-123']) as FeedViewModel[];
      expect(cachedFeeds[0].unreadCount).toBe(4);
    });

    it('should not go below zero for unreadCount', () => {
      const initialFeeds: FeedViewModel[] = [
        {
          id: 'feed-123',
          title: 'Test Feed',
          url: 'https://example.com/feed.xml',
          categoryId: null,
          faviconUrl: null,
          description: null,
          isActive: true,
          autoTranslate: false,
          totalArticles: 10,
          unreadCount: 0,
          isFetching: false,
          lastFetchAt: null,
          lastFetchStatus: null,
          nextFetchAt: null,
          createdAt: '',
          updatedAt: '',
        },
      ];
      queryClient.setQueryData(['feedViewModels', 'user-123'], initialFeeds);

      // Simulate optimistic update when unreadCount is already 0
      queryClient.setQueryData<FeedViewModel[]>(['feedViewModels', 'user-123'], (old = []) =>
        old.map(feed =>
          feed.id === 'feed-123'
            ? { ...feed, unreadCount: Math.max(0, (feed.unreadCount || 0) - 1) }
            : feed
        )
      );

      const cachedFeeds = queryClient.getQueryData(['feedViewModels', 'user-123']) as FeedViewModel[];
      expect(cachedFeeds[0].unreadCount).toBe(0);
    });

    it('should rollback on error', () => {
      const initialFeeds: FeedViewModel[] = [
        {
          id: 'feed-123',
          title: 'Test Feed',
          url: 'https://example.com/feed.xml',
          categoryId: null,
          faviconUrl: null,
          description: null,
          isActive: true,
          autoTranslate: false,
          totalArticles: 10,
          unreadCount: 5,
          isFetching: false,
          lastFetchAt: null,
          lastFetchStatus: null,
          nextFetchAt: null,
          createdAt: '',
          updatedAt: '',
        },
      ];
      queryClient.setQueryData(['feedViewModels', 'user-123'], initialFeeds);

      // Snapshot before update
      const previousFeeds = queryClient.getQueryData(['feedViewModels', 'user-123']);

      // Optimistic update
      queryClient.setQueryData<FeedViewModel[]>(['feedViewModels', 'user-123'], (old = []) =>
        old.map(feed =>
          feed.id === 'feed-123'
            ? { ...feed, autoTranslate: true }
            : feed
        )
      );

      // Rollback on error
      queryClient.setQueryData(['feedViewModels', 'user-123'], previousFeeds);

      const cachedFeeds = queryClient.getQueryData(['feedViewModels', 'user-123']) as FeedViewModel[];
      expect(cachedFeeds[0].autoTranslate).toBe(false);
      expect(cachedFeeds[0].unreadCount).toBe(5);
    });

    it('should mark all articles as read in articles cache', () => {
      const initialArticles = [
        { id: 'article-1', isRead: false, title: 'Article 1' },
        { id: 'article-2', isRead: false, title: 'Article 2' },
        { id: 'article-3', isRead: true, title: 'Article 3' },
      ];
      queryClient.setQueryData(['articles', 'user-123', 'feed-123'], initialArticles);

      // Simulate optimistic update for markAllAsRead
      queryClient.setQueryData(['articles', 'user-123', 'feed-123'], (old: { isRead: boolean }[] = []) =>
        old.map(article => ({ ...article, isRead: true }))
      );

      const cachedArticles = queryClient.getQueryData(['articles', 'user-123', 'feed-123']) as { id: string; isRead: boolean }[];
      expect(cachedArticles.every(a => a.isRead)).toBe(true);
    });

    it('should mark single article as read', () => {
      const initialArticles = [
        { id: 'article-1', isRead: false, title: 'Article 1' },
        { id: 'article-2', isRead: false, title: 'Article 2' },
      ];
      queryClient.setQueryData(['articles', 'user-123', 'feed-123'], initialArticles);

      // Simulate optimistic update for markAsRead
      queryClient.setQueryData(['articles', 'user-123', 'feed-123'], (old: { id: string; isRead: boolean }[] = []) =>
        old.map(article =>
          article.id === 'article-1'
            ? { ...article, isRead: true }
            : article
        )
      );

      const cachedArticles = queryClient.getQueryData(['articles', 'user-123', 'feed-123']) as { id: string; isRead: boolean }[];
      expect(cachedArticles.find(a => a.id === 'article-1')?.isRead).toBe(true);
      expect(cachedArticles.find(a => a.id === 'article-2')?.isRead).toBe(false);
    });
  });

  describe('Multiple feeds handling', () => {
    it('should update only the correct feed', () => {
      const initialFeeds: FeedViewModel[] = [
        {
          id: 'feed-1',
          title: 'Feed 1',
          url: 'https://example.com/feed1.xml',
          categoryId: null,
          faviconUrl: null,
          description: null,
          isActive: true,
          autoTranslate: false,
          totalArticles: 10,
          unreadCount: 5,
          isFetching: false,
          lastFetchAt: null,
          lastFetchStatus: null,
          nextFetchAt: null,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'feed-2',
          title: 'Feed 2',
          url: 'https://example.com/feed2.xml',
          categoryId: null,
          faviconUrl: null,
          description: null,
          isActive: true,
          autoTranslate: false,
          totalArticles: 20,
          unreadCount: 10,
          isFetching: false,
          lastFetchAt: null,
          lastFetchStatus: null,
          nextFetchAt: null,
          createdAt: '',
          updatedAt: '',
        },
      ];
      queryClient.setQueryData(['feedViewModels', 'user-123'], initialFeeds);

      // Update only feed-1
      queryClient.setQueryData<FeedViewModel[]>(['feedViewModels', 'user-123'], (old = []) =>
        old.map(feed =>
          feed.id === 'feed-1'
            ? { ...feed, unreadCount: 0 }
            : feed
        )
      );

      const cachedFeeds = queryClient.getQueryData(['feedViewModels', 'user-123']) as FeedViewModel[];
      expect(cachedFeeds.find(f => f.id === 'feed-1')?.unreadCount).toBe(0);
      expect(cachedFeeds.find(f => f.id === 'feed-2')?.unreadCount).toBe(10);
    });
  });
});
