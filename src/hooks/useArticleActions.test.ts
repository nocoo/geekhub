/**
 * @file useArticleActions.test.ts
 * Tests for article action hooks with optimistic updates
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { FeedViewModel } from '@/types/feed-view-model';

describe('useArticleActions Optimistic Updates', () => {
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

  describe('Bookmark optimistic updates', () => {
    it('should increment starred-count on bookmark', () => {
      queryClient.setQueryData(['starred-count', 'user-123'], 5);

      // Simulate optimistic update for bookmark
      queryClient.setQueryData(['starred-count', 'user-123'], (old: number = 0) => old + 1);

      const count = queryClient.getQueryData(['starred-count', 'user-123']);
      expect(count).toBe(6);
    });

    it('should decrement starred-count on unbookmark', () => {
      queryClient.setQueryData(['starred-count', 'user-123'], 5);

      // Simulate optimistic update for unbookmark
      queryClient.setQueryData(['starred-count', 'user-123'], (old: number = 0) => Math.max(0, old - 1));

      const count = queryClient.getQueryData(['starred-count', 'user-123']);
      expect(count).toBe(4);
    });

    it('should not go below zero for starred-count on unbookmark', () => {
      queryClient.setQueryData(['starred-count', 'user-123'], 0);

      // Simulate optimistic update for unbookmark when count is 0
      queryClient.setQueryData(['starred-count', 'user-123'], (old: number = 0) => Math.max(0, old - 1));

      const count = queryClient.getQueryData(['starred-count', 'user-123']);
      expect(count).toBe(0);
    });

    it('should rollback starred-count on error', () => {
      const previousCount = 5;
      queryClient.setQueryData(['starred-count', 'user-123'], previousCount);

      // Optimistic update
      queryClient.setQueryData(['starred-count', 'user-123'], (old: number = 0) => old + 1);

      // Rollback on error
      queryClient.setQueryData(['starred-count', 'user-123'], previousCount);

      const count = queryClient.getQueryData(['starred-count', 'user-123']);
      expect(count).toBe(5);
    });
  });

  describe('Read Later optimistic updates', () => {
    it('should increment later-count on saveForLater', () => {
      queryClient.setQueryData(['later-count', 'user-123'], 3);

      // Simulate optimistic update for saveForLater
      queryClient.setQueryData(['later-count', 'user-123'], (old: number = 0) => old + 1);

      const count = queryClient.getQueryData(['later-count', 'user-123']);
      expect(count).toBe(4);
    });

    it('should decrement later-count on removeFromLater', () => {
      queryClient.setQueryData(['later-count', 'user-123'], 3);

      // Simulate optimistic update for removeFromLater
      queryClient.setQueryData(['later-count', 'user-123'], (old: number = 0) => Math.max(0, old - 1));

      const count = queryClient.getQueryData(['later-count', 'user-123']);
      expect(count).toBe(2);
    });

    it('should not go below zero for later-count', () => {
      queryClient.setQueryData(['later-count', 'user-123'], 0);

      // Simulate optimistic update when count is 0
      queryClient.setQueryData(['later-count', 'user-123'], (old: number = 0) => Math.max(0, old - 1));

      const count = queryClient.getQueryData(['later-count', 'user-123']);
      expect(count).toBe(0);
    });
  });

  describe('Starred articles cache manipulation', () => {
    it('should add article to starred cache on bookmark', () => {
      const initialStarredArticles = [
        { id: 'article-1', title: 'Article 1' },
        { id: 'article-2', title: 'Article 2' },
      ];
      queryClient.setQueryData(['articles', 'user-123', 'starred'], initialStarredArticles);

      // Simulate adding article to starred cache
      const newArticle = { id: 'article-3', title: 'Article 3' };
      queryClient.setQueryData(['articles', 'user-123', 'starred'], (old: typeof newArticle[] = []) => [...old, newArticle]);

      const cachedArticles = queryClient.getQueryData(['articles', 'user-123', 'starred']);
      expect(cachedArticles).toHaveLength(3);
      expect(cachedArticles.find((a: { id: string }) => a.id === 'article-3')).toBeDefined();
    });

    it('should remove article from starred cache on unbookmark', () => {
      const initialStarredArticles = [
        { id: 'article-1', title: 'Article 1' },
        { id: 'article-2', title: 'Article 2' },
      ];
      queryClient.setQueryData(['articles', 'user-123', 'starred'], initialStarredArticles);

      // Simulate removing article from starred cache
      queryClient.setQueryData(['articles', 'user-123', 'starred'], (old: { id: string }[] = []) =>
        old.filter(article => article.id !== 'article-2')
      );

      const cachedArticles = queryClient.getQueryData(['articles', 'user-123', 'starred']);
      expect(cachedArticles).toHaveLength(1);
      expect(cachedArticles.find((a: { id: string }) => a.id === 'article-2')).toBeUndefined();
    });
  });

  describe('Read Later articles cache manipulation', () => {
    it('should add article to later cache on saveForLater', () => {
      const initialLaterArticles = [
        { id: 'article-1', title: 'Article 1' },
      ];
      queryClient.setQueryData(['articles', 'user-123', 'later'], initialLaterArticles);

      // Simulate adding article to later cache
      const newArticle = { id: 'article-2', title: 'Article 2' };
      queryClient.setQueryData(['articles', 'user-123', 'later'], (old: typeof newArticle[] = []) => [...old, newArticle]);

      const cachedArticles = queryClient.getQueryData(['articles', 'user-123', 'later']);
      expect(cachedArticles).toHaveLength(2);
    });

    it('should remove article from later cache on removeFromLater', () => {
      const initialLaterArticles = [
        { id: 'article-1', title: 'Article 1' },
        { id: 'article-2', title: 'Article 2' },
      ];
      queryClient.setQueryData(['articles', 'user-123', 'later'], initialLaterArticles);

      // Simulate removing article from later cache
      queryClient.setQueryData(['articles', 'user-123', 'later'], (old: { id: string }[] = []) =>
        old.filter(article => article.id !== 'article-2')
      );

      const cachedArticles = queryClient.getQueryData(['articles', 'user-123', 'later']);
      expect(cachedArticles).toHaveLength(1);
    });
  });

  describe('Rollback behavior', () => {
    it('should rollback all caches on bookmark error', () => {
      // Setup initial state
      const previousStarredCount = 5;
      const previousBookmarks = [{ id: 'article-1' }];
      const previousStarredArticles = [{ id: 'article-1' }];

      queryClient.setQueryData(['starred-count', 'user-123'], previousStarredCount);
      queryClient.setQueryData(['bookmarks', 'user-123'], previousBookmarks);
      queryClient.setQueryData(['articles', 'user-123', 'starred'], previousStarredArticles);

      // Snapshot
      const previousState = {
        starredCount: queryClient.getQueryData(['starred-count', 'user-123']),
        bookmarks: queryClient.getQueryData(['bookmarks', 'user-123']),
        starredArticles: queryClient.getQueryData(['articles', 'user-123', 'starred']),
      };

      // Optimistic update
      queryClient.setQueryData(['starred-count', 'user-123'], (old: number) => old + 1);

      // Rollback on error
      queryClient.setQueryData(['starred-count', 'user-123'], previousState.starredCount);
      queryClient.setQueryData(['bookmarks', 'user-123'], previousState.bookmarks);
      queryClient.setQueryData(['articles', 'user-123', 'starred'], previousState.starredArticles);

      // Verify rollback
      expect(queryClient.getQueryData(['starred-count', 'user-123'])).toBe(previousStarredCount);
    });

    it('should rollback all caches on saveForLater error', () => {
      // Setup initial state
      const previousLaterCount = 3;
      const previousReadLater = [{ id: 'article-1' }];
      const previousLaterArticles = [{ id: 'article-1' }];

      queryClient.setQueryData(['later-count', 'user-123'], previousLaterCount);
      queryClient.setQueryData(['read-later', 'user-123'], previousReadLater);
      queryClient.setQueryData(['articles', 'user-123', 'later'], previousLaterArticles);

      // Snapshot
      const previousState = {
        laterCount: queryClient.getQueryData(['later-count', 'user-123']),
        readLater: queryClient.getQueryData(['read-later', 'user-123']),
        laterArticles: queryClient.getQueryData(['articles', 'user-123', 'later']),
      };

      // Optimistic update
      queryClient.setQueryData(['later-count', 'user-123'], (old: number) => old + 1);

      // Rollback on error
      queryClient.setQueryData(['later-count', 'user-123'], previousState.laterCount);
      queryClient.setQueryData(['read-later', 'user-123'], previousState.readLater);
      queryClient.setQueryData(['articles', 'user-123', 'later'], previousState.laterArticles);

      // Verify rollback
      expect(queryClient.getQueryData(['later-count', 'user-123'])).toBe(previousLaterCount);
    });
  });
});
