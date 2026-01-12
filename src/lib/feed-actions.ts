/**
 * @file feed-actions.ts
 * Service layer for feed operations.
 * Extracts API calls from components to follow MVVM architecture.
 *
 * This module provides:
 * - toggleAutoTranslate: Toggle auto-translate setting for a feed
 * - fetchFeed: Trigger feed content fetch
 */

import { FeedViewModel } from '@/types/feed-view-model';

/**
 * Toggle auto-translate setting for a feed
 *
 * @param feedId - The feed ID
 * @param enabled - Whether to enable auto-translate
 * @returns Promise resolving when complete
 * @throws Error if API call fails
 */
export async function toggleAutoTranslate(feedId: string, enabled: boolean): Promise<void> {
  const response = await fetch(`/api/feeds/${feedId}/auto-translate`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ auto_translate: enabled }),
  });

  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: 'Failed to update auto-translate' }));
    throw new Error(error);
  }
}

/**
 * Trigger a feed content fetch
 *
 * @param feedId - The feed ID to fetch
 * @param feedTitle - Optional feed title for notifications
 * @returns Promise resolving when fetch is triggered
 * @throws Error if fetch fails
 */
export async function fetchFeed(feedId: string, feedTitle?: string): Promise<void> {
  const response = await fetch(`/api/feeds/${feedId}/fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: 'Failed to fetch feed' }));
    throw new Error(error);
  }
}

/**
 * Mark all articles in a feed as read
 *
 * @param feedId - The feed ID
 * @returns Promise resolving when complete
 */
export async function markAllAsRead(feedId: string): Promise<void> {
  const response = await fetch(`/api/feeds/${feedId}/mark-all-read`, {
    method: 'POST',
  });

  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: 'Failed to mark all as read' }));
    throw new Error(error);
  }
}

/**
 * Mark a single article as read
 *
 * @param articleId - The article ID
 * @param feedId - The feed ID
 * @returns Promise resolving when complete
 */
export async function markArticleAsRead(articleId: string, feedId: string): Promise<void> {
  const response = await fetch(`/api/articles/${articleId}/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedId }),
  });

  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: 'Failed to mark as read' }));
    throw new Error(error);
  }
}

/**
 * Get feed view model by ID from cache or fetch
 * This is a utility for optimistic updates
 *
 * @param feedId - The feed ID
 * @returns FeedViewModel or null if not found
 */
export async function getFeedViewModel(feedId: string): Promise<FeedViewModel | null> {
  const response = await fetch(`/api/feeds/${feedId}`);
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  return data.feed;
}
