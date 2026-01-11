import pLimit from 'p-limit';
import { flushSync } from 'react-dom';
import type { QueryClient } from '@tanstack/react-query';
import type { Article } from '@/hooks/useDatabase';
import {
  getTranslationFromCache,
  saveTranslationToCache,
  hasTranslationInCache
} from '@/lib/translation-cache';

export interface TranslationRequest {
  article: Article;
  feedId: string;
  userId: string | undefined;
  queryClient: QueryClient;
  aiSettings: any;
  onSuccess?: (articleId: string, translation: { translatedTitle: string; translatedDescription: string }) => void;
}

class TranslationQueue {
  private limit: ReturnType<typeof pLimit>;
  private queue: Map<string, TranslationRequest> = new Map();
  private processing: Set<string> = new Set();

  constructor(concurrency: number = 10) {
    this.limit = pLimit(concurrency);
  }

  /**
   * Add article to translation queue
   */
  async translate(request: TranslationRequest): Promise<void> {
    const { article, feedId, userId, queryClient, aiSettings, onSuccess } = request;

    // Skip if already processing
    if (this.processing.has(article.id)) {
      return;
    }

    // Check cache first
    if (hasTranslationInCache(article.id)) {
      const cached = getTranslationFromCache(article.id);
      if (cached) {
        this.applyTranslation(queryClient, userId, feedId, article.id, {
          translatedTitle: cached.translatedTitle,
          translatedDescription: cached.translatedDescription,
        });
        onSuccess?.(article.id, {
          translatedTitle: cached.translatedTitle,
          translatedDescription: cached.translatedDescription,
        });
        return;
      }
    }

    // Mark as processing
    this.processing.add(article.id);
    this.queue.set(article.id, request);

    // Add to queue with concurrency limit
    const task = async () => {
      try {
        await this.performTranslation(request);
      } finally {
        this.processing.delete(article.id);
        this.queue.delete(article.id);
      }
    };

    // p-limit returns a promise, we don't need to await it here
    this.limit(task);
  }

  /**
   * Perform the actual translation
   */
  private async performTranslation(request: TranslationRequest): Promise<void> {
    const { article, feedId, userId, queryClient, aiSettings, onSuccess } = request;

    try {
      const response = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articles: [{
            id: article.id,
            title: article.title,
            description: article.description,
          }],
          aiSettings,
        }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Translation failed');
      }

      const { translations } = await response.json();
      const translation = translations[0];

      // Save to cache
      saveTranslationToCache({
        articleId: article.id,
        originalTitle: article.title,
        originalDescription: article.description,
        translatedTitle: translation.translatedTitle,
        translatedDescription: translation.translatedDescription,
        timestamp: Date.now(),
      });

      // Apply translation to UI
      this.applyTranslation(queryClient, userId, feedId, article.id, {
        translatedTitle: translation.translatedTitle,
        translatedDescription: translation.translatedDescription,
      });

      onSuccess?.(article.id, {
        translatedTitle: translation.translatedTitle,
        translatedDescription: translation.translatedDescription,
      });
    } catch (error) {
      console.error(`Translation failed for article ${article.id}:`, error);
    }
  }

  /**
   * Apply translation to article in query cache
   */
  private applyTranslation(
    queryClient: QueryClient,
    userId: string | undefined,
    feedId: string,
    articleId: string,
    translation: { translatedTitle: string; translatedDescription: string }
  ): void {
    flushSync(() => {
      queryClient.setQueryData<Article[]>(['articles', userId, feedId], (old = []) =>
        old.map(article => {
          if (article.id === articleId) {
            return {
              ...article,
              translatedTitle: translation.translatedTitle,
              translatedDescription: translation.translatedDescription,
            };
          }
          return article;
        })
      );
    });
  }

  /**
   * Check if article is in queue or processing
   */
  isInQueue(articleId: string): boolean {
    return this.queue.has(articleId) || this.processing.has(articleId);
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.size;
  }

  /**
   * Get processing count
   */
  getProcessingCount(): number {
    return this.processing.size;
  }
}

// Singleton instance
let translationQueue: TranslationQueue | null = null;

export function getTranslationQueue(concurrency: number = 10): TranslationQueue {
  if (!translationQueue) {
    translationQueue = new TranslationQueue(concurrency);
  }
  return translationQueue;
}

export function clearTranslationQueue(): void {
  translationQueue = null;
}
