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
});
