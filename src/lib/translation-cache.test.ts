import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  getTranslationFromCache,
  saveTranslationToCache,
  hasTranslationInCache,
  clearTranslationCache,
  getTranslationCacheSize,
  type TranslationCacheEntry,
} from './translation-cache';

const CACHE_KEY = 'geekhub_translations';

describe('translation-cache', () => {
  // Mock localStorage
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    
    // @ts-ignore - mocking localStorage
    global.localStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => { mockStorage[key] = value; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { mockStorage = {}; },
      length: 0,
      key: () => null,
    };
  });

  afterEach(() => {
    mockStorage = {};
  });

  const createEntry = (id: string, timestamp?: number): TranslationCacheEntry => ({
    articleId: id,
    originalTitle: `Original Title ${id}`,
    originalDescription: `Original Description ${id}`,
    translatedTitle: `Translated Title ${id}`,
    translatedDescription: `Translated Description ${id}`,
    timestamp: timestamp ?? Date.now(),
  });

  describe('getTranslationFromCache', () => {
    test('returns null when cache is empty', () => {
      expect(getTranslationFromCache('article-1')).toBeNull();
    });

    test('returns null when article not in cache', () => {
      const entry = createEntry('article-1');
      saveTranslationToCache(entry);

      expect(getTranslationFromCache('article-2')).toBeNull();
    });

    test('returns cached entry when exists', () => {
      const entry = createEntry('article-1');
      saveTranslationToCache(entry);

      const result = getTranslationFromCache('article-1');
      expect(result).not.toBeNull();
      expect(result?.articleId).toBe('article-1');
      expect(result?.translatedTitle).toBe('Translated Title article-1');
    });

    test('returns null for invalid JSON in localStorage', () => {
      mockStorage[CACHE_KEY] = 'invalid-json';

      expect(getTranslationFromCache('article-1')).toBeNull();
    });
  });

  describe('saveTranslationToCache', () => {
    test('saves entry to empty cache', () => {
      const entry = createEntry('article-1');
      saveTranslationToCache(entry);

      expect(getTranslationFromCache('article-1')).not.toBeNull();
    });

    test('updates existing entry', () => {
      const entry1 = createEntry('article-1');
      entry1.translatedTitle = 'First Translation';
      saveTranslationToCache(entry1);

      const entry2 = createEntry('article-1');
      entry2.translatedTitle = 'Updated Translation';
      saveTranslationToCache(entry2);

      const result = getTranslationFromCache('article-1');
      expect(result?.translatedTitle).toBe('Updated Translation');
    });

    test('preserves existing entries when adding new', () => {
      saveTranslationToCache(createEntry('article-1'));
      saveTranslationToCache(createEntry('article-2'));

      expect(getTranslationFromCache('article-1')).not.toBeNull();
      expect(getTranslationFromCache('article-2')).not.toBeNull();
    });

    test('enforces max cache size of 100', () => {
      // Add 105 entries with increasing timestamps
      for (let i = 0; i < 105; i++) {
        saveTranslationToCache(createEntry(`article-${i}`, i * 1000));
      }

      const size = getTranslationCacheSize();
      expect(size).toBe(100);

      // Oldest entries should be removed (0-4)
      expect(getTranslationFromCache('article-0')).toBeNull();
      expect(getTranslationFromCache('article-4')).toBeNull();

      // Newer entries should remain (5-104)
      expect(getTranslationFromCache('article-5')).not.toBeNull();
      expect(getTranslationFromCache('article-104')).not.toBeNull();
    });
  });

  describe('hasTranslationInCache', () => {
    test('returns false when cache is empty', () => {
      expect(hasTranslationInCache('article-1')).toBe(false);
    });

    test('returns false when article not in cache', () => {
      saveTranslationToCache(createEntry('article-1'));
      expect(hasTranslationInCache('article-2')).toBe(false);
    });

    test('returns true when article is in cache', () => {
      saveTranslationToCache(createEntry('article-1'));
      expect(hasTranslationInCache('article-1')).toBe(true);
    });
  });

  describe('clearTranslationCache', () => {
    test('clears all cached entries', () => {
      saveTranslationToCache(createEntry('article-1'));
      saveTranslationToCache(createEntry('article-2'));
      saveTranslationToCache(createEntry('article-3'));

      clearTranslationCache();

      expect(getTranslationCacheSize()).toBe(0);
      expect(getTranslationFromCache('article-1')).toBeNull();
    });

    test('handles clearing empty cache', () => {
      clearTranslationCache();
      expect(getTranslationCacheSize()).toBe(0);
    });
  });

  describe('getTranslationCacheSize', () => {
    test('returns 0 for empty cache', () => {
      expect(getTranslationCacheSize()).toBe(0);
    });

    test('returns correct count after adding entries', () => {
      saveTranslationToCache(createEntry('article-1'));
      expect(getTranslationCacheSize()).toBe(1);

      saveTranslationToCache(createEntry('article-2'));
      expect(getTranslationCacheSize()).toBe(2);

      saveTranslationToCache(createEntry('article-3'));
      expect(getTranslationCacheSize()).toBe(3);
    });

    test('returns correct count after removing entries', () => {
      saveTranslationToCache(createEntry('article-1'));
      saveTranslationToCache(createEntry('article-2'));
      clearTranslationCache();
      expect(getTranslationCacheSize()).toBe(0);
    });

    test('returns 0 for invalid JSON in localStorage', () => {
      mockStorage[CACHE_KEY] = 'invalid-json';
      expect(getTranslationCacheSize()).toBe(0);
    });
  });

  describe('edge cases', () => {
    test('handles entry with empty strings', () => {
      const entry: TranslationCacheEntry = {
        articleId: 'empty-test',
        originalTitle: '',
        originalDescription: '',
        translatedTitle: '',
        translatedDescription: '',
        timestamp: Date.now(),
      };

      saveTranslationToCache(entry);
      const result = getTranslationFromCache('empty-test');

      expect(result).not.toBeNull();
      expect(result?.translatedTitle).toBe('');
    });

    test('handles entry with special characters', () => {
      const entry: TranslationCacheEntry = {
        articleId: 'special-chars',
        originalTitle: 'Title with "quotes" and \\backslashes\\',
        originalDescription: 'Description with <html> & entities',
        translatedTitle: '标题带有"引号"和\\反斜杠\\',
        translatedDescription: '描述带有<html>和&实体',
        timestamp: Date.now(),
      };

      saveTranslationToCache(entry);
      const result = getTranslationFromCache('special-chars');

      expect(result?.originalTitle).toBe('Title with "quotes" and \\backslashes\\');
      expect(result?.translatedTitle).toBe('标题带有"引号"和\\反斜杠\\');
    });

    test('handles concurrent saves to same article', () => {
      const entry1 = createEntry('concurrent-test');
      entry1.translatedTitle = 'First';
      
      const entry2 = createEntry('concurrent-test');
      entry2.translatedTitle = 'Second';

      saveTranslationToCache(entry1);
      saveTranslationToCache(entry2);

      const result = getTranslationFromCache('concurrent-test');
      expect(result?.translatedTitle).toBe('Second');
      expect(getTranslationCacheSize()).toBe(1);
    });
  });
});
