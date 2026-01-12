/**
 * @file useFeedActions.ts
 * React hooks for feed actions with optimistic updates.
 * Following MVVM pattern - components use these hooks, not direct API calls.
 */

"use client";

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useFeedFetch, useFeedFetchInternal } from '@/contexts/FeedFetchContext';
import { toggleAutoTranslate, fetchFeed, markAllAsRead, markArticleAsRead } from '@/lib/feed-actions';
import { FeedViewModel } from '@/types/feed-view-model';
import { toast } from '@/components/ui/sonner';

/**
 * Hook to toggle auto-translate setting with optimistic update
 */
export function useToggleAutoTranslate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ feedId, enabled }: { feedId: string; enabled: boolean }) =>
      toggleAutoTranslate(feedId, enabled),
    onMutate: async ({ feedId, enabled }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['feedViewModels', user?.id] });

      // Snapshot previous value
      const previousFeeds = queryClient.getQueryData<FeedViewModel[]>(['feedViewModels', user?.id]);

      // Optimistically update
      queryClient.setQueryData<FeedViewModel[]>(['feedViewModels', user?.id], (old = []) =>
        old.map(feed =>
          feed.id === feedId
            ? { ...feed, autoTranslate: enabled }
            : feed
        )
      );

      return { previousFeeds };
    },
    onError: (_error, { feedId, enabled }, context) => {
      // Rollback on error
      if (context?.previousFeeds) {
        queryClient.setQueryData(['feedViewModels', user?.id], context.previousFeeds);
      }
      toast.error('更新翻译设置失败');
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['feedViewModels', user?.id] });
    },
  });
}

/**
 * Hook to trigger feed fetch
 * Optimistically updates fetching state for immediate UI feedback
 * Note: State is removed by SSE fetch-complete event when all articles are saved
 */
export function useFetchFeed() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { setFetchingFeeds } = useFeedFetchInternal();

  return useMutation({
    mutationFn: ({ feedId, feedTitle }: { feedId: string; feedTitle?: string }) =>
      fetchFeed(feedId, feedTitle),
    onMutate: async ({ feedId }) => {
      // Optimistically add feed to fetching set
      setFetchingFeeds(prev => {
        const newSet = new Set(prev);
        newSet.add(feedId);
        return newSet;
      });

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['feedViewModels', user?.id] });
    },
    onSuccess: (_data, { feedTitle }) => {
      toast.success(feedTitle ? `开始抓取「${feedTitle}」` : '正在抓取最新文章...');
    },
    onError: (_error, { feedId }) => {
      // Remove from fetching set on error (SSE won't fire)
      setFetchingFeeds(prev => {
        const newSet = new Set(prev);
        newSet.delete(feedId);
        return newSet;
      });
      toast.error('抓取失败');
    },
  });
}

/**
 * Hook to get current fetching state for a feed
 * This is a read-only hook for UI display
 */
export function useIsFeedFetching(feedId: string | null): boolean {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { isFeedFetching } = useFeedFetch();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return feedId ? isFeedFetching(feedId) : false;
}

/**
 * Hook to mark all articles as read with optimistic update
 */
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (feedId: string) => markAllAsRead(feedId),
    onMutate: async (feedId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['articles', user?.id, feedId] });
      await queryClient.cancelQueries({ queryKey: ['feedViewModels', user?.id] });

      // Snapshot previous values
      const previousArticles = queryClient.getQueryData(['articles', user?.id, feedId]);
      const previousFeeds = queryClient.getQueryData<FeedViewModel[]>(['feedViewModels', user?.id]);

      // Optimistically update articles
      queryClient.setQueryData(['articles', user?.id, feedId], (old: unknown[]) =>
        (old as { isRead: boolean }[]).map(article => ({ ...article, isRead: true }))
      );

      // Optimistically update feed unread count
      queryClient.setQueryData<FeedViewModel[]>(['feedViewModels', user?.id], (old = []) =>
        old.map(feed =>
          feed.id === feedId
            ? { ...feed, unreadCount: 0 }
            : feed
        )
      );

      return { previousArticles, previousFeeds };
    },
    onError: (_error, feedId, context) => {
      if (context?.previousArticles) {
        queryClient.setQueryData(['articles', user?.id, feedId], context.previousArticles);
      }
      if (context?.previousFeeds) {
        queryClient.setQueryData(['feedViewModels', user?.id], context.previousFeeds);
      }
    },
    onSettled: (_data, error, feedId) => {
      if (error) {
        queryClient.invalidateQueries({ queryKey: ['articles', user?.id, feedId] });
        queryClient.invalidateQueries({ queryKey: ['feedViewModels', user?.id] });
      }
    },
  });
}

/**
 * Hook to mark a single article as read with optimistic update
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ articleId, feedId }: { articleId: string; feedId: string }) =>
      markArticleAsRead(articleId, feedId),
    onMutate: async ({ articleId, feedId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['articles', user?.id] });
      await queryClient.cancelQueries({ queryKey: ['feedViewModels', user?.id] });

      // Snapshot previous values
      const previousArticles = queryClient.getQueryData(['articles', user?.id, feedId]);
      const previousFeeds = queryClient.getQueryData<FeedViewModel[]>(['feedViewModels', user?.id]);

      // Optimistically update article
      queryClient.setQueryData(['articles', user?.id, feedId], (old: unknown[]) =>
        (old as { id: string; isRead: boolean }[]).map(article =>
          article.id === articleId
            ? { ...article, isRead: true }
            : article
        )
      );

      // Optimistically update feed unread count
      queryClient.setQueryData<FeedViewModel[]>(['feedViewModels', user?.id], (old = []) =>
        old.map(feed =>
          feed.id === feedId
            ? { ...feed, unreadCount: Math.max(0, (feed.unreadCount || 0) - 1) }
            : feed
        )
      );

      return { previousArticles, previousFeeds, feedId };
    },
    onSettled: (_data, error, { feedId }) => {
      // Always refetch to ensure unread count is accurate
      queryClient.invalidateQueries({ queryKey: ['feedViewModels', user?.id] });
      if (error) {
        // Only log error, UI already has optimistic update
        console.error('Mark as read failed:', error);
      }
    },
  });
}
