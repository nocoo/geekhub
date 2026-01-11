const CACHE_KEY = 'geekhub_translations';
const MAX_CACHE_SIZE = 100;

export interface TranslationCacheEntry {
  articleId: string;
  originalTitle: string;
  originalDescription: string;
  translatedTitle: string;
  translatedDescription: string;
  timestamp: number;
}

interface TranslationCache {
  [articleId: string]: TranslationCacheEntry;
}

/**
 * Get translation from cache
 */
export function getTranslationFromCache(articleId: string): TranslationCacheEntry | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const cache: TranslationCache = JSON.parse(cached);
    const entry = cache[articleId];

    if (!entry) return null;

    // Check if cache entry is valid (optional: add expiration logic)
    return entry;
  } catch (error) {
    console.error('Failed to read translation cache:', error);
    return null;
  }
}

/**
 * Save translation to cache
 */
export function saveTranslationToCache(entry: TranslationCacheEntry): void {
  if (typeof window === 'undefined') return;

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    let cache: TranslationCache = cached ? JSON.parse(cached) : {};

    // Add new entry
    cache[entry.articleId] = entry;

    // Enforce max cache size by removing oldest entries
    const entries = Object.values(cache).sort((a, b) => a.timestamp - b.timestamp);
    if (entries.length > MAX_CACHE_SIZE) {
      // Remove oldest entries beyond max size
      const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
      toRemove.forEach(e => delete cache[e.articleId]);
    }

    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Failed to save translation cache:', error);
  }
}

/**
 * Check if translation exists in cache
 */
export function hasTranslationInCache(articleId: string): boolean {
  return getTranslationFromCache(articleId) !== null;
}

/**
 * Clear all translation cache
 */
export function clearTranslationCache(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.error('Failed to clear translation cache:', error);
  }
}

/**
 * Get cache size (number of entries)
 */
export function getTranslationCacheSize(): number {
  if (typeof window === 'undefined') return 0;

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return 0;

    const cache: TranslationCache = JSON.parse(cached);
    return Object.keys(cache).length;
  } catch (error) {
    console.error('Failed to get translation cache size:', error);
    return 0;
  }
}
