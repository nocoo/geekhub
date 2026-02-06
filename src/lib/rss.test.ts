import { describe, test, expect, mock, beforeEach } from 'bun:test';

const mockParseURL = mock(() => Promise.resolve({
  title: 'Test Feed',
  description: 'A test feed',
  link: 'https://example.com',
  items: [
    {
      title: 'Article 1',
      link: 'https://example.com/1',
      pubDate: '2026-02-01T00:00:00Z',
      content: 'Content 1',
    },
    {
      title: 'Article 2',
      link: 'https://example.com/2',
      pubDate: '2026-02-02T00:00:00Z',
      content: 'Content 2',
    },
  ],
}));

mock.module('rss-parser', () => ({
  default: class MockParser {
    parseURL = mockParseURL;
  },
}));

describe('fetchRss', () => {
  beforeEach(() => {
    mockParseURL.mockClear();
  });

  test('returns feed data with required fields', async () => {
    const { fetchRss } = await import('./rss');
    
    const result = await fetchRss('https://example.com/feed.xml');
    
    expect(result).toHaveProperty('feed');
    expect(result).toHaveProperty('cached');
    expect(result).toHaveProperty('fetchedAt');
  });

  test('cached is always false (no file caching)', async () => {
    const { fetchRss } = await import('./rss');
    
    const result = await fetchRss('https://example.com/feed.xml');
    
    expect(result.cached).toBe(false);
  });

  test('fetchedAt is a valid ISO date string', async () => {
    const { fetchRss } = await import('./rss');
    
    const result = await fetchRss('https://example.com/feed.xml');
    
    const date = new Date(result.fetchedAt);
    expect(date.toISOString()).toBe(result.fetchedAt);
  });

  test('calls parser.parseURL with the provided URL', async () => {
    const { fetchRss } = await import('./rss');
    
    await fetchRss('https://example.com/custom-feed.xml');
    
    expect(mockParseURL).toHaveBeenCalledWith('https://example.com/custom-feed.xml');
  });

  test('returns parsed feed from parser', async () => {
    const { fetchRss } = await import('./rss');
    
    const result = await fetchRss('https://example.com/feed.xml');
    
    expect(result.feed.title).toBe('Test Feed');
    expect(result.feed.items).toHaveLength(2);
    expect(result.feed.items[0].title).toBe('Article 1');
  });

  test('handles skipCache parameter (ignored in current implementation)', async () => {
    const { fetchRss } = await import('./rss');
    
    const result1 = await fetchRss('https://example.com/feed.xml', true);
    const result2 = await fetchRss('https://example.com/feed.xml', false);
    
    expect(result1.cached).toBe(false);
    expect(result2.cached).toBe(false);
  });

  test('propagates parser errors', async () => {
    mockParseURL.mockImplementationOnce(() => 
      Promise.reject(new Error('Network error'))
    );
    
    const { fetchRss } = await import('./rss');
    
    await expect(fetchRss('https://invalid.example.com/feed.xml'))
      .rejects.toThrow('Network error');
  });

  test('handles empty feed items', async () => {
    mockParseURL.mockImplementationOnce(() => Promise.resolve({
      title: 'Empty Feed',
      items: [],
    }));
    
    const { fetchRss } = await import('./rss');
    
    const result = await fetchRss('https://example.com/empty.xml');
    
    expect(result.feed.title).toBe('Empty Feed');
    expect(result.feed.items).toHaveLength(0);
  });
});
