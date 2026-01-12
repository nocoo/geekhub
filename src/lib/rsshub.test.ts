/**
 * RssHub URL Parser Tests
 *
 * Tests for RssHub URL parsing and resolution utilities.
 * These are pure functions that can be tested without external dependencies.
 *
 * Run: bun test -- rsshub.test.ts
 */

import { describe, it, expect } from 'bun:test';
import {
  parseRssHubUrl,
  resolveRssHubUrl,
  isRssHubUrl,
  extractRssHubRoute,
  RssHubParseResult,
  RssHubConfig,
} from './rsshub';

describe('parseRssHubUrl', () => {
  describe('invalid inputs', () => {
    it('should return invalid for null input', () => {
      const result = parseRssHubUrl(null as any);
      expect(result.isValid).toBe(false);
    });

    it('should return invalid for undefined input', () => {
      const result = parseRssHubUrl(undefined as any);
      expect(result.isValid).toBe(false);
    });

    it('should return invalid for empty string', () => {
      const result = parseRssHubUrl('');
      expect(result.isValid).toBe(false);
    });

    it('should return invalid for non-string input', () => {
      const result = parseRssHubUrl(123 as any);
      expect(result.isValid).toBe(false);
    });
  });

  describe('rsshub:// protocol', () => {
    it('should parse rsshub://namespace/route format', () => {
      const result = parseRssHubUrl('rsshub://sspai/index');
      expect(result.isValid).toBe(true);
      expect(result.feedUrl).toBe('https://rsshub.app/sspai/index');
      expect(result.baseUrl).toBe('https://rsshub.app');
    });

    it('should parse rsshub:// with custom instance domain', () => {
      const result = parseRssHubUrl('rsshub://my-rsshub.com/sspai/index');
      expect(result.isValid).toBe(true);
      expect(result.feedUrl).toBe('https://my-rsshub.com/sspai/index');
      expect(result.baseUrl).toBe('https://my-rsshub.com');
    });

    it('should parse rsshub:// with route parameters', () => {
      const result = parseRssHubUrl('rsshub://twitter/user/karlseguin');
      expect(result.isValid).toBe(true);
      expect(result.feedUrl).toBe('https://rsshub.app/twitter/user/karlseguin');
    });

    it('should handle rsshub:// with only namespace (no route)', () => {
      const result = parseRssHubUrl('rsshub://sspai');
      expect(result.isValid).toBe(true);
      expect(result.feedUrl).toBe('https://rsshub.app/sspai');
    });

    it('should use custom instance URL from config', () => {
      const config: RssHubConfig = { instanceUrl: 'https://custom.rsshub.app' };
      const result = parseRssHubUrl('rsshub://namespace/route', config);
      expect(result.isValid).toBe(true);
      expect(result.feedUrl).toBe('https://custom.rsshub.app/namespace/route');
      expect(result.baseUrl).toBe('https://custom.rsshub.app');
    });
  });

  describe('https:// RssHub URLs', () => {
    it('should parse https://rsshub.app URL', () => {
      const result = parseRssHubUrl('https://rsshub.app/sspai/index');
      expect(result.isValid).toBe(true);
      expect(result.feedUrl).toBe('https://rsshub.app/sspai/index');
      expect(result.baseUrl).toBe('https://rsshub.app');
    });

    it('should parse https://rsshub.app subdomain URL', () => {
      const result = parseRssHubUrl('https://demo.rsshub.app/twitter/user/123');
      expect(result.isValid).toBe(true);
      expect(result.baseUrl).toBe('https://demo.rsshub.app');
    });

    it('should parse http:// URL', () => {
      const result = parseRssHubUrl('http://rsshub.app/sspai/index');
      expect(result.isValid).toBe(true);
    });

    it('should reject non-RssHub https URLs', () => {
      const result = parseRssHubUrl('https://example.com/feed');
      expect(result.isValid).toBe(false);
    });

    it('should reject https URLs from unknown hosts', () => {
      const result = parseRssHubUrl('https://random-site.com/rss');
      expect(result.isValid).toBe(false);
    });
  });

  describe('namespace/route format', () => {
    it('should parse namespace/route format', () => {
      const result = parseRssHubUrl('sspai/index');
      expect(result.isValid).toBe(true);
      expect(result.feedUrl).toBe('https://rsshub.app/sspai/index');
    });

    it('should parse nested route', () => {
      const result = parseRssHubUrl('twitter/user/karlseguin');
      expect(result.isValid).toBe(true);
      expect(result.feedUrl).toBe('https://rsshub.app/twitter/user/karlseguin');
    });
  });

  describe('error handling', () => {
    it('should return error message for invalid format', () => {
      const result = parseRssHubUrl('not-a-valid-format');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('known RssHub hosts', () => {
    it('should recognize rsshub.rssforever.com', () => {
      const result = parseRssHubUrl('https://rsshub.rssforever.com/twitter/user/123');
      expect(result.isValid).toBe(true);
    });

    it('should recognize rss.wifease.com', () => {
      const result = parseRssHubUrl('https://rss.wifease.com/sspai/index');
      expect(result.isValid).toBe(true);
    });

    it('should recognize hosts containing rsshub', () => {
      const result = parseRssHubUrl('https://my-custom-rsshub.example.com/feed');
      expect(result.isValid).toBe(true);
    });
  });
});

describe('resolveRssHubUrl', () => {
  it('should return feedUrl for valid input', () => {
    const result = resolveRssHubUrl('rsshub://sspai/index');
    expect(result).toBe('https://rsshub.app/sspai/index');
  });

  it('should return null for invalid input', () => {
    const result = resolveRssHubUrl('invalid-url');
    expect(result).toBeNull();
  });

  it('should return null for empty string', () => {
    const result = resolveRssHubUrl('');
    expect(result).toBeNull();
  });

  it('should use custom instance from config', () => {
    const config: RssHubConfig = { instanceUrl: 'https://custom.rsshub.app' };
    const result = resolveRssHubUrl('namespace/route', config);
    expect(result).toBe('https://custom.rsshub.app/namespace/route');
  });

  it('should return null for non-RssHub URLs', () => {
    const result = resolveRssHubUrl('https://example.com/feed');
    expect(result).toBeNull();
  });
});

describe('isRssHubUrl', () => {
  it('should return true for valid rsshub:// URL', () => {
    expect(isRssHubUrl('rsshub://sspai/index')).toBe(true);
  });

  it('should return true for valid https RssHub URL', () => {
    expect(isRssHubUrl('https://rsshub.app/sspai/index')).toBe(true);
  });

  it('should return false for invalid URL', () => {
    expect(isRssHubUrl('invalid')).toBe(false);
  });

  it('should return false for non-RssHub URLs', () => {
    expect(isRssHubUrl('https://example.com/feed')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isRssHubUrl('')).toBe(false);
  });

  it('should use config instance URL', () => {
    const config: RssHubConfig = { instanceUrl: 'https://custom.rsshub.app' };
    expect(isRssHubUrl('namespace/route', config)).toBe(true);
  });
});

describe('extractRssHubRoute', () => {
  it('should extract namespace and route from rsshub:// URL', () => {
    const result = extractRssHubRoute('rsshub://sspai/index');
    expect(result.namespace).toBe('sspai');
    expect(result.route).toBe('index');
    expect(result.fullRoute).toBe('sspai/index');
  });

  it('should extract nested route', () => {
    const result = extractRssHubRoute('rsshub://twitter/user/karlseguin');
    expect(result.namespace).toBe('twitter');
    expect(result.route).toBe('user/karlseguin');
    expect(result.fullRoute).toBe('twitter/user/karlseguin');
  });

  it('should return nulls for invalid input', () => {
    const result = extractRssHubRoute('invalid');
    expect(result.namespace).toBeNull();
    expect(result.route).toBeNull();
    expect(result.fullRoute).toBeNull();
  });

  it('should return nulls for empty string', () => {
    const result = extractRssHubRoute('');
    expect(result.namespace).toBeNull();
    expect(result.route).toBeNull();
    expect(result.fullRoute).toBeNull();
  });

  it('should extract route from https URL', () => {
    const result = extractRssHubRoute('https://rsshub.app/sspai/index');
    expect(result.namespace).toBe('sspai');
    expect(result.route).toBe('index');
  });

  it('should handle route without namespace - returns null', () => {
    const result = extractRssHubRoute('rsshub://onlyone');
    expect(result.namespace).toBeNull();
  });
});

describe('RssHubParseResult interface', () => {
  it('should accept valid result', () => {
    const result: RssHubParseResult = {
      isValid: true,
      feedUrl: 'https://rsshub.app/feed',
      baseUrl: 'https://rsshub.app',
    };
    expect(result.isValid).toBe(true);
  });

  it('should accept invalid result with error', () => {
    const result: RssHubParseResult = {
      isValid: false,
      error: 'Invalid input',
    };
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Invalid input');
  });

  it('should allow optional fields', () => {
    const minimalResult: RssHubParseResult = {
      isValid: false,
    };
    expect(minimalResult.feedUrl).toBeUndefined();
    expect(minimalResult.baseUrl).toBeUndefined();
    expect(minimalResult.error).toBeUndefined();
  });
});

describe('RssHubConfig interface', () => {
  it('should accept config with instanceUrl', () => {
    const config: RssHubConfig = {
      instanceUrl: 'https://custom.rsshub.app',
    };
    expect(config.instanceUrl).toBe('https://custom.rsshub.app');
  });

  it('should accept undefined config', () => {
    const result = parseRssHubUrl('rsshub://sspai/index', undefined);
    expect(result.isValid).toBe(true);
  });
});

describe('URL format examples', () => {
  it('should handle juejin route', () => {
    const result = parseRssHubUrl('rsshub://juejin/category/backend');
    expect(result.isValid).toBe(true);
    expect(result.feedUrl).toBe('https://rsshub.app/juejin/category/backend');
  });

  it('should handle telegram channel', () => {
    const result = parseRssHubUrl('rsshub://telegram/channel');
    expect(result.isValid).toBe(true);
    expect(result.feedUrl).toBe('https://rsshub.app/telegram/channel');
  });

  it('should handle github trending', () => {
    const result = parseRssHubUrl('rsshub://github/trending/daily');
    expect(result.isValid).toBe(true);
    expect(result.feedUrl).toBe('https://rsshub.app/github/trending/daily');
  });
});
