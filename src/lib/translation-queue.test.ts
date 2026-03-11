/**
 * TranslationQueue Tests
 *
 * Tests for the translation queue with concurrency control.
 *
 * Run: bun test -- translation-queue.test.ts
 */

import { describe, it, expect } from 'bun:test';
import type { TranslationRequest } from './translation-queue';
import type { Article } from '@/hooks/useDatabase';
import type { QueryClient } from '@tanstack/react-query';

describe('TranslationRequest interface', () => {
  it('should require all mandatory fields', () => {
    const request: TranslationRequest = {
      article: { id: '1', title: 'T', description: 'D', url: 'https://x.com', feedId: 'f' } as Article,
      feedId: 'f',
      userId: 'u',
      queryClient: {} as QueryClient,
      aiSettings: { enabled: true, provider: 'test', apiKey: '', baseUrl: '' },
    };

    expect(request.article).toBeDefined();
    expect(request.feedId).toBe('f');
    expect(request.userId).toBe('u');
    expect(request.queryClient).toBeDefined();
    expect(request.aiSettings).toBeDefined();
  });

  it('should allow optional onSuccess callback', () => {
    const request: TranslationRequest = {
      article: { id: '1', title: 'T', description: 'D', url: 'https://x.com', feedId: 'f' } as Article,
      feedId: 'f',
      userId: 'u',
      queryClient: {} as QueryClient,
      aiSettings: { enabled: true, provider: 'test', apiKey: '', baseUrl: '' },
      onSuccess: (_id, _translation) => {},
    };

    expect(request.onSuccess).toBeDefined();
    expect(typeof request.onSuccess).toBe('function');
  });

  it('should allow userId to be undefined', () => {
    const request: TranslationRequest = {
      article: { id: '1', title: 'T', description: 'D', url: 'https://x.com', feedId: 'f' } as Article,
      feedId: 'f',
      userId: undefined,
      queryClient: {} as QueryClient,
      aiSettings: { enabled: true, provider: 'test', apiKey: '', baseUrl: '' },
    };

    expect(request.userId).toBeUndefined();
  });
});
