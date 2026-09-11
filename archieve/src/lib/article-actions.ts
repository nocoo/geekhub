/**
 * @file article-actions.ts
 * Service layer for article operations.
 * Extracts API calls from components to follow MVVM architecture.
 */

import { AISettings } from '@/lib/settings';

/**
 * Fetch full content for an article
 *
 * @param articleId - The article ID
 * @param url - The article URL
 * @returns Promise resolving to full content
 * @throws Error if fetch fails
 */
export async function fetchFullContent(articleId: string, url: string): Promise<string> {
  const response = await fetch(`/api/articles/${articleId}/fetch-full`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: 'Failed to fetch full content' }));
    throw new Error(error);
  }

  const data = await response.json();
  if (!data.success || !data.content) {
    throw new Error('Failed to fetch full content');
  }

  return data.content;
}

/**
 * Translate article content using AI
 *
 * @param articleId - The article ID
 * @param content - The content to translate
 * @param aiSettings - AI settings for translation
 * @returns Promise resolving to translated content
 * @throws Error if translation fails
 */
export async function translateContent(
  articleId: string,
  content: string,
  aiSettings: AISettings
): Promise<string> {
  const response = await fetch('/api/ai/translate-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      articleId,
      content,
      aiSettings,
    }),
  });

  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: 'Translation failed' }));
    throw new Error(error);
  }

  const { translatedContent } = await response.json();
  return translatedContent;
}

/**
 * Bookmark an article
 *
 * @param articleId - The article ID
 * @param notes - Optional notes for the bookmark
 * @returns Promise resolving when complete
 * @throws Error if operation fails
 */
export async function bookmarkArticle(articleId: string, notes?: string): Promise<void> {
  const response = await fetch(`/api/articles/${articleId}/bookmark`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });

  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: 'Failed to bookmark article' }));
    throw new Error(error);
  }
}

/**
 * Remove article bookmark
 *
 * @param articleId - The article ID
 * @returns Promise resolving when complete
 * @throws Error if operation fails
 */
export async function unbookmarkArticle(articleId: string): Promise<void> {
  const response = await fetch(`/api/articles/${articleId}/bookmark`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: 'Failed to remove bookmark' }));
    throw new Error(error);
  }
}

/**
 * Save article for later reading
 *
 * @param articleId - The article ID
 * @returns Promise resolving when complete
 * @throws Error if operation fails
 */
export async function saveForLater(articleId: string): Promise<void> {
  const response = await fetch(`/api/articles/${articleId}/read-later`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: 'Failed to save article' }));
    throw new Error(error);
  }
}

/**
 * Remove article from read later
 *
 * @param articleId - The article ID
 * @returns Promise resolving when complete
 * @throws Error if operation fails
 */
export async function removeFromLater(articleId: string): Promise<void> {
  const response = await fetch(`/api/articles/${articleId}/read-later`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: 'Failed to remove article' }));
    throw new Error(error);
  }
}
