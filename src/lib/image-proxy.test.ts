import { describe, test, expect } from 'bun:test';
import { getProxyImageUrl, getRefererFromUrl } from './image-proxy';

describe('image-proxy', () => {
  describe('getProxyImageUrl', () => {
    test('generates proxy URL with encoded data', () => {
      const imageUrl = 'https://example.com/image.jpg';
      const result = getProxyImageUrl(imageUrl);

      expect(result).toMatch(/^\/api\/image-proxy\?data=/);
    });

    test('encodes imageUrl in the payload', () => {
      const imageUrl = 'https://example.com/image.jpg';
      const result = getProxyImageUrl(imageUrl);

      const dataParam = result.split('?data=')[1];
      const decoded = JSON.parse(decodeURIComponent(atob(dataParam)));

      expect(decoded.url).toBe(imageUrl);
      expect(decoded.referer).toBeUndefined();
    });

    test('encodes referer when provided', () => {
      const imageUrl = 'https://example.com/image.jpg';
      const referer = 'https://source.com/';
      const result = getProxyImageUrl(imageUrl, referer);

      const dataParam = result.split('?data=')[1];
      const decoded = JSON.parse(decodeURIComponent(atob(dataParam)));

      expect(decoded.url).toBe(imageUrl);
      expect(decoded.referer).toBe(referer);
    });

    test('handles URLs with special characters', () => {
      const imageUrl = 'https://example.com/image?size=large&format=png';
      const result = getProxyImageUrl(imageUrl);

      const dataParam = result.split('?data=')[1];
      const decoded = JSON.parse(decodeURIComponent(atob(dataParam)));

      expect(decoded.url).toBe(imageUrl);
    });

    test('handles URLs with Unicode characters', () => {
      const imageUrl = 'https://example.com/图片.jpg';
      const result = getProxyImageUrl(imageUrl);

      const dataParam = result.split('?data=')[1];
      const decoded = JSON.parse(decodeURIComponent(atob(dataParam)));

      expect(decoded.url).toBe(imageUrl);
    });

    test('handles complex referer URLs', () => {
      const imageUrl = 'https://cdn.example.com/img.png';
      const referer = 'https://blog.example.com/posts/2026/01/article?utm_source=rss';
      const result = getProxyImageUrl(imageUrl, referer);

      const dataParam = result.split('?data=')[1];
      const decoded = JSON.parse(decodeURIComponent(atob(dataParam)));

      expect(decoded.url).toBe(imageUrl);
      expect(decoded.referer).toBe(referer);
    });
  });

  describe('getRefererFromUrl', () => {
    test('extracts domain from simple URL', () => {
      const url = 'https://example.com/path/to/page';
      expect(getRefererFromUrl(url)).toBe('https://example.com/');
    });

    test('handles URL with port', () => {
      const url = 'http://localhost:3000/api/test';
      expect(getRefererFromUrl(url)).toBe('http://localhost:3000/');
    });

    test('handles URL with subdomain', () => {
      const url = 'https://blog.example.com/posts/123';
      expect(getRefererFromUrl(url)).toBe('https://blog.example.com/');
    });

    test('preserves protocol (http vs https)', () => {
      expect(getRefererFromUrl('http://example.com/page')).toBe('http://example.com/');
      expect(getRefererFromUrl('https://example.com/page')).toBe('https://example.com/');
    });

    test('returns empty string for invalid URL', () => {
      expect(getRefererFromUrl('not-a-valid-url')).toBe('');
      expect(getRefererFromUrl('')).toBe('');
    });

    test('handles URL without path', () => {
      const url = 'https://example.com';
      expect(getRefererFromUrl(url)).toBe('https://example.com/');
    });

    test('handles URL with query params and hash', () => {
      const url = 'https://example.com/page?foo=bar#section';
      expect(getRefererFromUrl(url)).toBe('https://example.com/');
    });

    test('strips authentication info from URL', () => {
      const url = 'https://user:pass@example.com/secret';
      expect(getRefererFromUrl(url)).toBe('https://example.com/');
    });
  });
});
