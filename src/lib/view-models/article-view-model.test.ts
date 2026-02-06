import { describe, it, expect } from 'bun:test';
import { extractFirstImage, transformArticleToViewModel } from './article-view-model';

describe('extractFirstImage', () => {
  it('should return null for empty html', () => {
    expect(extractFirstImage('')).toBeNull();
    expect(extractFirstImage(null as any)).toBeNull();
  });

  it('should extract image from standard img tag', () => {
    const html = '<p>Text</p><img src="https://example.com/image.jpg" alt="test">';
    expect(extractFirstImage(html)).toBe('https://example.com/image.jpg');
  });

  it('should extract image from img tag without quotes', () => {
    const html = '<img src=https://example.com/image.png>';
    expect(extractFirstImage(html)).toBe('https://example.com/image.png');
  });

  it('should extract image from data-src attribute', () => {
    const html = '<img data-src="https://example.com/lazy.jpg" src="placeholder.gif">';
    expect(extractFirstImage(html)).toBe('https://example.com/lazy.jpg');
  });

  it('should extract image from source srcset', () => {
    const html = '<picture><source srcset="https://example.com/srcset.webp"></picture>';
    expect(extractFirstImage(html)).toBe('https://example.com/srcset.webp');
  });

  it('should decode HTML entities in URL', () => {
    const html = '<img src="https://example.com/image.jpg?a=1&amp;b=2">';
    expect(extractFirstImage(html)).toBe('https://example.com/image.jpg?a=1&b=2');
  });

  it('should handle protocol-relative URLs', () => {
    const html = '<img src="//cdn.example.com/image.jpg">';
    expect(extractFirstImage(html)).toBe('https://cdn.example.com/image.jpg');
  });

  it('should skip data: URLs and return null if no valid image', () => {
    const html = '<img src="data:image/png;base64,abc123">';
    expect(extractFirstImage(html)).toBeNull();
  });

  it('should return null for html with no valid images', () => {
    const html = '<p>No images here</p>';
    expect(extractFirstImage(html)).toBeNull();
  });

  it('should return null for relative URLs without protocol', () => {
    const html = '<img src="/images/local.jpg">';
    expect(extractFirstImage(html)).toBeNull();
  });
});

describe('transformArticleToViewModel', () => {
  const feedInfo = { name: 'Test Feed', icon: 'https://example.com/icon.png' };

  it('should transform raw article to view model', () => {
    const rawArticle = {
      id: 'article-1',
      feed_id: 'feed-1',
      title: 'Test Article',
      url: 'https://example.com/article',
      author: 'Author Name',
      published_at: '2024-01-15T10:00:00Z',
      content: '<p>Content here</p>',
      content_text: 'Content here',
      summary: 'Summary text',
      hash: 'abc123',
    };

    const result = transformArticleToViewModel(rawArticle, feedInfo, false);

    expect(result.id).toBe('article-1');
    expect(result.feedId).toBe('feed-1');
    expect(result.title).toBe('Test Article');
    expect(result.url).toBe('https://example.com/article');
    expect(result.author).toBe('Author Name');
    expect(result.feedName).toBe('Test Feed');
    expect(result.feedIcon).toBe('https://example.com/icon.png');
    expect(result.isRead).toBe(false);
    expect(result.hash).toBe('abc123');
  });

  it('should handle missing optional fields', () => {
    const rawArticle = {
      id: 'article-2',
      feed_id: 'feed-2',
      title: 'Minimal Article',
      url: 'https://example.com/minimal',
      hash: 'def456',
    };

    const result = transformArticleToViewModel(rawArticle, feedInfo, true);

    expect(result.author).toBe('');
    expect(result.description).toBe('');
    expect(result.isRead).toBe(true);
    expect(result.publishedAt).toBeNull();
  });

  it('should use feedId if feed_id is not present', () => {
    const rawArticle = {
      id: 'article-3',
      feedId: 'feed-3',
      title: 'Article with feedId',
      url: 'https://example.com/3',
      hash: 'ghi789',
    };

    const result = transformArticleToViewModel(rawArticle, feedInfo, false);

    expect(result.feedId).toBe('feed-3');
  });

  it('should extract image from content', () => {
    const rawArticle = {
      id: 'article-4',
      feed_id: 'feed-4',
      title: 'Article with Image',
      url: 'https://example.com/4',
      content: '<p>Text</p><img src="https://example.com/featured.jpg">',
      hash: 'jkl012',
    };

    const result = transformArticleToViewModel(rawArticle, feedInfo, false);

    expect(result.image).toBe('https://example.com/featured.jpg');
  });

  it('should use summary for description if available', () => {
    const rawArticle = {
      id: 'article-5',
      feed_id: 'feed-5',
      title: 'Article with Summary',
      url: 'https://example.com/5',
      summary: 'This is the summary',
      content_text: 'This is the content text',
      hash: 'mno345',
    };

    const result = transformArticleToViewModel(rawArticle, feedInfo, false);

    expect(result.description).toBe('This is the summary');
  });

  it('should fallback to content_text for description', () => {
    const rawArticle = {
      id: 'article-6',
      feed_id: 'feed-6',
      title: 'Article without Summary',
      url: 'https://example.com/6',
      content_text: 'Content text as fallback',
      hash: 'pqr678',
    };

    const result = transformArticleToViewModel(rawArticle, feedInfo, false);

    expect(result.description).toBe('Content text as fallback');
  });
});
