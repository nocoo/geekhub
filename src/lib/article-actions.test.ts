/**
 * @file article-actions.test.ts
 * TDD tests for article actions service layer
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';

// Mock fetch globally
const mockFetch = mock(() => Promise.resolve(new Response()));
global.fetch = mockFetch as unknown as typeof fetch;

describe('Article Actions Service', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('fetchFullContent', () => {
    it('should fetch full content successfully', async () => {
      const mockContent = '<html><body>Full content here</body></html>';
      const mockJson = mock(() => Promise.resolve({ success: true, content: mockContent }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: true, json: mockJson } as unknown as Response)
      );

      const { fetchFullContent } = await import('./article-actions');

      const result = await fetchFullContent('article-123', 'https://example.com/article');

      expect(global.fetch).toHaveBeenCalledWith('/api/articles/article-123/fetch-full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/article' }),
      });
      expect(result).toBe(mockContent);
    });

    it('should throw error when API fails', async () => {
      const mockJson = mock(() => Promise.resolve({ error: 'Failed to fetch' }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: false, json: mockJson } as unknown as Response)
      );

      const { fetchFullContent } = await import('./article-actions');

      await expect(fetchFullContent('article-123', 'https://example.com/article'))
        .rejects.toThrow('Failed to fetch');
    });

    it('should throw error when response has no content', async () => {
      const mockJson = mock(() => Promise.resolve({ success: true, content: null }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: true, json: mockJson } as unknown as Response)
      );

      const { fetchFullContent } = await import('./article-actions');

      await expect(fetchFullContent('article-123', 'https://example.com/article'))
        .rejects.toThrow('Failed to fetch full content');
    });
  });

  describe('translateContent', () => {
    it('should translate content successfully', async () => {
      const mockTranslatedContent = 'Translated content here';
      const mockJson = mock(() => Promise.resolve({ translatedContent: mockTranslatedContent }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: true, json: mockJson } as unknown as Response)
      );

      const { translateContent } = await import('./article-actions');

      const aiSettings = {
        enabled: true,
        provider: 'openai',
        baseUrl: 'https://api.openai.com',
        model: 'gpt-4',
        apiKey: 'test-key',
      };

      const result = await translateContent('article-123', 'Original content', aiSettings);

      expect(global.fetch).toHaveBeenCalledWith('/api/ai/translate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: 'article-123',
          content: 'Original content',
          aiSettings,
        }),
      });
      expect(result).toBe(mockTranslatedContent);
    });

    it('should throw error when translation fails', async () => {
      const mockJson = mock(() => Promise.resolve({ error: 'Translation failed' }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: false, json: mockJson } as unknown as Response)
      );

      const { translateContent } = await import('./article-actions');

      const aiSettings = {
        enabled: true,
        provider: 'openai',
        baseUrl: 'https://api.openai.com',
        model: 'gpt-4',
        apiKey: 'test-key',
      };

      await expect(translateContent('article-123', 'Original content', aiSettings))
        .rejects.toThrow('Translation failed');
    });
  });

  describe('bookmarkArticle', () => {
    it('should bookmark article successfully', async () => {
      const mockJson = mock(() => Promise.resolve({ success: true }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: true, json: mockJson } as unknown as Response)
      );

      const { bookmarkArticle } = await import('./article-actions');

      await bookmarkArticle('article-123', 'My notes');

      expect(global.fetch).toHaveBeenCalledWith('/api/articles/article-123/bookmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'My notes' }),
      });
    });

    it('should bookmark without notes', async () => {
      const mockJson = mock(() => Promise.resolve({ success: true }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: true, json: mockJson } as unknown as Response)
      );

      const { bookmarkArticle } = await import('./article-actions');

      await bookmarkArticle('article-123');

      expect(global.fetch).toHaveBeenCalledWith('/api/articles/article-123/bookmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: undefined }),
      });
    });

    it('should throw error when bookmark fails', async () => {
      const mockJson = mock(() => Promise.resolve({ error: 'Failed to bookmark' }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: false, json: mockJson } as unknown as Response)
      );

      const { bookmarkArticle } = await import('./article-actions');

      await expect(bookmarkArticle('article-123')).rejects.toThrow('Failed to bookmark');
    });
  });

  describe('unbookmarkArticle', () => {
    it('should unbookmark article successfully', async () => {
      const mockJson = mock(() => Promise.resolve({ success: true }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: true, json: mockJson } as unknown as Response)
      );

      const { unbookmarkArticle } = await import('./article-actions');

      await unbookmarkArticle('article-123');

      expect(global.fetch).toHaveBeenCalledWith('/api/articles/article-123/bookmark', {
        method: 'DELETE',
      });
    });

    it('should throw error when unbookmark fails', async () => {
      const mockJson = mock(() => Promise.resolve({ error: 'Failed to remove bookmark' }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: false, json: mockJson } as unknown as Response)
      );

      const { unbookmarkArticle } = await import('./article-actions');

      await expect(unbookmarkArticle('article-123')).rejects.toThrow('Failed to remove bookmark');
    });
  });

  describe('saveForLater', () => {
    it('should save article for later successfully', async () => {
      const mockJson = mock(() => Promise.resolve({ success: true }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: true, json: mockJson } as unknown as Response)
      );

      const { saveForLater } = await import('./article-actions');

      await saveForLater('article-123');

      expect(global.fetch).toHaveBeenCalledWith('/api/articles/article-123/read-later', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    });

    it('should throw error when save fails', async () => {
      const mockJson = mock(() => Promise.resolve({ error: 'Failed to save' }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: false, json: mockJson } as unknown as Response)
      );

      const { saveForLater } = await import('./article-actions');

      await expect(saveForLater('article-123')).rejects.toThrow('Failed to save');
    });
  });

  describe('removeFromLater', () => {
    it('should remove article from later successfully', async () => {
      const mockJson = mock(() => Promise.resolve({ success: true }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: true, json: mockJson } as unknown as Response)
      );

      const { removeFromLater } = await import('./article-actions');

      await removeFromLater('article-123');

      expect(global.fetch).toHaveBeenCalledWith('/api/articles/article-123/read-later', {
        method: 'DELETE',
      });
    });

    it('should throw error when remove fails', async () => {
      const mockJson = mock(() => Promise.resolve({ error: 'Failed to remove' }));
      mockFetch.mockImplementation(() =>
        Promise.resolve({ ok: false, json: mockJson } as unknown as Response)
      );

      const { removeFromLater } = await import('./article-actions');

      await expect(removeFromLater('article-123')).rejects.toThrow('Failed to remove');
    });
  });
});
