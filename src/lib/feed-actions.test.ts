/**
 * @file feed-actions.test.ts
 * TDD tests for feed actions service layer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

describe('Feed Actions Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('toggleAutoTranslate', () => {
    it('should call API to enable auto-translate', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ success: true }) };
      (global.fetch as unknown as vi.Mock).mockResolvedValue(mockResponse);

      const { toggleAutoTranslate } = await import('./feed-actions');

      await toggleAutoTranslate('feed-123', true);

      expect(global.fetch).toHaveBeenCalledWith('/api/feeds/feed-123/auto-translate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_translate: true }),
      });
    });

    it('should call API to disable auto-translate', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ success: true }) };
      (global.fetch as unknown as vi.Mock).mockResolvedValue(mockResponse);

      const { toggleAutoTranslate } = await import('./feed-actions');

      await toggleAutoTranslate('feed-123', false);

      expect(global.fetch).toHaveBeenCalledWith('/api/feeds/feed-123/auto-translate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_translate: false }),
      });
    });

    it('should throw error when API fails', async () => {
      const mockResponse = {
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Failed to update' }),
      };
      (global.fetch as unknown as vi.Mock).mockResolvedValue(mockResponse);

      const { toggleAutoTranslate } = await import('./feed-actions');

      await expect(toggleAutoTranslate('feed-123', true)).rejects.toThrow('Failed to update');
    });
  });

  describe('fetchFeed', () => {
    it('should call feed fetch API', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ success: true }) };
      (global.fetch as unknown as vi.Mock).mockResolvedValue(mockResponse);

      const { fetchFeed } = await import('./feed-actions');

      await fetchFeed('feed-123', 'Test Feed');

      expect(global.fetch).toHaveBeenCalledWith('/api/feeds/feed-123/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('should work without feed title', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ success: true }) };
      (global.fetch as unknown as vi.Mock).mockResolvedValue(mockResponse);

      const { fetchFeed } = await import('./feed-actions');

      await fetchFeed('feed-123');

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should throw error when fetch fails', async () => {
      const mockResponse = {
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Fetch failed' }),
      };
      (global.fetch as unknown as vi.Mock).mockResolvedValue(mockResponse);

      const { fetchFeed } = await import('./feed-actions');

      await expect(fetchFeed('feed-123')).rejects.toThrow('Fetch failed');
    });
  });

  describe('markAllAsRead', () => {
    it('should call mark all as read API', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ success: true }) };
      (global.fetch as unknown as vi.Mock).mockResolvedValue(mockResponse);

      const { markAllAsRead } = await import('./feed-actions');

      await markAllAsRead('feed-123');

      expect(global.fetch).toHaveBeenCalledWith('/api/feeds/feed-123/mark-all-read', {
        method: 'POST',
      });
    });

    it('should throw error when API fails', async () => {
      const mockResponse = {
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Failed to mark all as read' }),
      };
      (global.fetch as unknown as vi.Mock).mockResolvedValue(mockResponse);

      const { markAllAsRead } = await import('./feed-actions');

      await expect(markAllAsRead('feed-123')).rejects.toThrow('Failed to mark all as read');
    });

    it('should use default error message when json parsing fails', async () => {
      const mockResponse = {
        ok: false,
        json: vi.fn().mockRejectedValue(new Error('Parse error')),
      };
      (global.fetch as unknown as vi.Mock).mockResolvedValue(mockResponse);

      const { markAllAsRead } = await import('./feed-actions');

      await expect(markAllAsRead('feed-123')).rejects.toThrow('Failed to mark all as read');
    });
  });

  describe('markArticleAsRead', () => {
    it('should call mark article as read API', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ success: true }) };
      (global.fetch as unknown as vi.Mock).mockResolvedValue(mockResponse);

      const { markArticleAsRead } = await import('./feed-actions');

      await markArticleAsRead('article-456', 'feed-123');

      expect(global.fetch).toHaveBeenCalledWith('/api/articles/article-456/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedId: 'feed-123' }),
      });
    });

    it('should throw error when API fails', async () => {
      const mockResponse = {
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Failed to mark as read' }),
      };
      (global.fetch as unknown as vi.Mock).mockResolvedValue(mockResponse);

      const { markArticleAsRead } = await import('./feed-actions');

      await expect(markArticleAsRead('article-456', 'feed-123')).rejects.toThrow('Failed to mark as read');
    });

    it('should use default error message when json parsing fails', async () => {
      const mockResponse = {
        ok: false,
        json: vi.fn().mockRejectedValue(new Error('Parse error')),
      };
      (global.fetch as unknown as vi.Mock).mockResolvedValue(mockResponse);

      const { markArticleAsRead } = await import('./feed-actions');

      await expect(markArticleAsRead('article-456', 'feed-123')).rejects.toThrow('Failed to mark as read');
    });
  });

  describe('getFeedViewModel', () => {
    it('should return feed view model on success', async () => {
      const mockFeed = { id: 'feed-123', title: 'Test Feed', url: 'https://example.com/feed' };
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ feed: mockFeed }) };
      (global.fetch as unknown as vi.Mock).mockResolvedValue(mockResponse);

      const { getFeedViewModel } = await import('./feed-actions');

      const result = await getFeedViewModel('feed-123');

      expect(global.fetch).toHaveBeenCalledWith('/api/feeds/feed-123');
      expect(result).toEqual(mockFeed);
    });

    it('should return null when API fails', async () => {
      const mockResponse = { ok: false, json: vi.fn().mockResolvedValue({}) };
      (global.fetch as unknown as vi.Mock).mockResolvedValue(mockResponse);

      const { getFeedViewModel } = await import('./feed-actions');

      const result = await getFeedViewModel('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when feed not found', async () => {
      const mockResponse = { ok: false, status: 404 };
      (global.fetch as unknown as vi.Mock).mockResolvedValue(mockResponse);

      const { getFeedViewModel } = await import('./feed-actions');

      const result = await getFeedViewModel('nonexistent');

      expect(result).toBeNull();
    });
  });
});
