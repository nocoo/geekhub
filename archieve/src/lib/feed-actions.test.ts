/**
 * @file feed-actions.test.ts
 * TDD tests for feed actions service layer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn(() => Promise.resolve(new Response()));
global.fetch = mockFetch as unknown as typeof fetch;

describe('Feed Actions Service', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('toggleAutoTranslate', () => {
    it('should call API to enable auto-translate', async () => {
      const mockJson = vi.fn(() => Promise.resolve({ success: true }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: true, json: mockJson } as unknown as Response)
      );

      const { toggleAutoTranslate } = await import('./feed-actions');

      await toggleAutoTranslate('feed-123', true);

      expect(global.fetch).toHaveBeenCalledWith('/api/feeds/feed-123/auto-translate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_translate: true }),
      });
    });

    it('should call API to disable auto-translate', async () => {
      const mockJson = vi.fn(() => Promise.resolve({ success: true }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: true, json: mockJson } as unknown as Response)
      );

      const { toggleAutoTranslate } = await import('./feed-actions');

      await toggleAutoTranslate('feed-123', false);

      expect(global.fetch).toHaveBeenCalledWith('/api/feeds/feed-123/auto-translate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_translate: false }),
      });
    });

    it('should throw error when API fails', async () => {
      const mockJson = vi.fn(() => Promise.resolve({ error: 'Failed to update' }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: false, json: mockJson } as unknown as Response)
      );

      const { toggleAutoTranslate } = await import('./feed-actions');

      await expect(toggleAutoTranslate('feed-123', true)).rejects.toThrow('Failed to update');
    });

    it('should use default error when json parsing fails', async () => {
      const mockJson = vi.fn(() => Promise.reject(new Error('Parse error')));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: false, json: mockJson } as unknown as Response)
      );

      const { toggleAutoTranslate } = await import('./feed-actions');

      await expect(toggleAutoTranslate('feed-123', true)).rejects.toThrow('Failed to update auto-translate');
    });
  });

  describe('fetchFeed', () => {
    it('should call feed fetch API', async () => {
      const mockJson = vi.fn(() => Promise.resolve({ success: true }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: true, json: mockJson } as unknown as Response)
      );

      const { fetchFeed } = await import('./feed-actions');

      await fetchFeed('feed-123', 'Test Feed');

      expect(global.fetch).toHaveBeenCalledWith('/api/feeds/feed-123/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('should work without feed title', async () => {
      const mockJson = vi.fn(() => Promise.resolve({ success: true }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: true, json: mockJson } as unknown as Response)
      );

      const { fetchFeed } = await import('./feed-actions');

      await fetchFeed('feed-123');

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should throw error when fetch fails', async () => {
      const mockJson = vi.fn(() => Promise.resolve({ error: 'Fetch failed' }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: false, json: mockJson } as unknown as Response)
      );

      const { fetchFeed } = await import('./feed-actions');

      await expect(fetchFeed('feed-123')).rejects.toThrow('Fetch failed');
    });

    it('should use default error when json parsing fails', async () => {
      const mockJson = vi.fn(() => Promise.reject(new Error('Parse error')));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: false, json: mockJson } as unknown as Response)
      );

      const { fetchFeed } = await import('./feed-actions');

      await expect(fetchFeed('feed-123')).rejects.toThrow('Failed to fetch feed');
    });
  });

  describe('markAllAsRead', () => {
    it('should call mark all as read API', async () => {
      const mockJson = vi.fn(() => Promise.resolve({ success: true }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: true, json: mockJson } as unknown as Response)
      );

      const { markAllAsRead } = await import('./feed-actions');

      await markAllAsRead('feed-123');

      expect(global.fetch).toHaveBeenCalledWith('/api/feeds/feed-123/mark-all-read', {
        method: 'POST',
      });
    });

    it('should throw error when API fails', async () => {
      const mockJson = vi.fn(() => Promise.resolve({ error: 'Failed to mark all as read' }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: false, json: mockJson } as unknown as Response)
      );

      const { markAllAsRead } = await import('./feed-actions');

      await expect(markAllAsRead('feed-123')).rejects.toThrow('Failed to mark all as read');
    });

    it('should use default error message when json parsing fails', async () => {
      const mockJson = vi.fn(() => Promise.reject(new Error('Parse error')));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: false, json: mockJson } as unknown as Response)
      );

      const { markAllAsRead } = await import('./feed-actions');

      await expect(markAllAsRead('feed-123')).rejects.toThrow('Failed to mark all as read');
    });
  });

  describe('markArticleAsRead', () => {
    it('should call mark article as read API', async () => {
      const mockJson = vi.fn(() => Promise.resolve({ success: true }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: true, json: mockJson } as unknown as Response)
      );

      const { markArticleAsRead } = await import('./feed-actions');

      await markArticleAsRead('article-456', 'feed-123');

      expect(global.fetch).toHaveBeenCalledWith('/api/articles/article-456/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedId: 'feed-123' }),
      });
    });

    it('should throw error when API fails', async () => {
      const mockJson = vi.fn(() => Promise.resolve({ error: 'Failed to mark as read' }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: false, json: mockJson } as unknown as Response)
      );

      const { markArticleAsRead } = await import('./feed-actions');

      await expect(markArticleAsRead('article-456', 'feed-123')).rejects.toThrow('Failed to mark as read');
    });

    it('should use default error message when json parsing fails', async () => {
      const mockJson = vi.fn(() => Promise.reject(new Error('Parse error')));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: false, json: mockJson } as unknown as Response)
      );

      const { markArticleAsRead } = await import('./feed-actions');

      await expect(markArticleAsRead('article-456', 'feed-123')).rejects.toThrow('Failed to mark as read');
    });
  });

  describe('getFeedViewModel', () => {
    it('should return feed view model on success', async () => {
      const mockFeed = { id: 'feed-123', title: 'Test Feed', url: 'https://example.com/feed' };
      const mockJson = vi.fn(() => Promise.resolve({ feed: mockFeed }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: true, json: mockJson } as unknown as Response)
      );

      const { getFeedViewModel } = await import('./feed-actions');

      const result = await getFeedViewModel('feed-123');

      expect(global.fetch).toHaveBeenCalledWith('/api/feeds/feed-123');
      expect(result).toEqual(mockFeed);
    });

    it('should return null when API fails', async () => {
      const mockJson = vi.fn(() => Promise.resolve({}));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: false, json: mockJson } as unknown as Response)
      );

      const { getFeedViewModel } = await import('./feed-actions');

      const result = await getFeedViewModel('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when feed not found', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: false, status: 404 } as unknown as Response)
      );

      const { getFeedViewModel } = await import('./feed-actions');

      const result = await getFeedViewModel('nonexistent');

      expect(result).toBeNull();
    });
  });
});
