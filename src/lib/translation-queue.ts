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

  async translate(request: TranslationRequest): Promise<void> {
    const { article, feedId, userId, queryClient, onSuccess } = request;

    if (this.processing.has(article.id)) {
      return;
    }

    const translation = this.getTranslationFromCacheOrQueue(article.id);
    if (translation) {
      this.applyTranslation(queryClient, userId, feedId, article.id, translation);
      onSuccess?.(article.id, translation);
      return;
    }

    this.processing.add(article.id);
    this.queue.set(article.id, request);

    this.limit(async () => {
      try {
        await this.performTranslation(request);
      } finally {
        this.processing.delete(article.id);
        this.queue.delete(article.id);
      }
    });
  }

  private getTranslationFromCacheOrQueue(articleId: string): { translatedTitle: string; translatedDescription: string } | null {
    if (!hasTranslationInCache(articleId)) {
      return null;
    }

    const cached = getTranslationFromCache(articleId);
    if (!cached) {
      return null;
    }

    return {
      translatedTitle: cached.translatedTitle,
      translatedDescription: cached.translatedDescription,
    };
  }

  private async performTranslation(request: TranslationRequest): Promise<void> {
    const { article, feedId, userId, queryClient, aiSettings, onSuccess } = request;

    try {
      const translation = await this.fetchTranslation(article, aiSettings);
      this.saveTranslationToCache(article, translation);
      this.applyTranslation(queryClient, userId, feedId, article.id, translation);
      onSuccess?.(article.id, translation);
    } catch (error) {
      console.error(`Translation failed for article ${article.id}:`, error);
    }
  }

  private async fetchTranslation(article: Article, aiSettings: any): Promise<{ translatedTitle: string; translatedDescription: string }> {
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
    return translations[0];
  }

  private saveTranslationToCache(article: Article, translation: { translatedTitle: string; translatedDescription: string }): void {
    saveTranslationToCache({
      articleId: article.id,
      originalTitle: article.title,
      originalDescription: article.description,
      translatedTitle: translation.translatedTitle,
      translatedDescription: translation.translatedDescription,
      timestamp: Date.now(),
    });
  }

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

  isInQueue(articleId: string): boolean {
    return this.queue.has(articleId) || this.processing.has(articleId);
  }

  getQueueSize(): number {
    return this.queue.size;
  }

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
