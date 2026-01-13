/**
 * @file useArticleActions.ts
 * React hooks for article actions with optimistic updates.
 * Following MVVM pattern - components use these hooks, not direct API calls.
 */

"use client";

import { useViewModelAction } from './useViewModelAction';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { fetchFullContent, translateContent, bookmarkArticle, unbookmarkArticle, saveForLater, removeFromLater } from '@/lib/article-actions';
import { Article } from '@/hooks/useDatabase';
import { AISettings } from '@/lib/settings';

/**
 * Hook to fetch full article content
 */
export function useFetchFullContent() {
  return useViewModelAction({
    mutationFn: ({ articleId, url }: { articleId: string; url: string }) =>
      fetchFullContent(articleId, url),
    errorMessage: '获取全文失败',
  });
}

/**
 * Hook to translate article content
 */
export function useTranslateContent() {
  return useViewModelAction({
    mutationFn: ({ articleId, content, aiSettings }: { articleId: string; content: string; aiSettings: AISettings }) =>
      translateContent(articleId, content, aiSettings),
    successMessage: '翻译完成',
    errorMessage: '翻译失败',
  });
}

/**
 * Hook to bookmark an article with optimistic update
 */
export function useBookmarkArticle() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useViewModelAction({
    mutationFn: ({ articleId, notes }: { articleId: string; notes?: string }) =>
      bookmarkArticle(articleId, notes),
    successMessage: '已收藏',
    onMutate: async ({ articleId }) => {
      await queryClient.cancelQueries({ queryKey: ['bookmarks', user?.id] });
      await queryClient.cancelQueries({ queryKey: ['starred-count', user?.id] });
      await queryClient.cancelQueries({ queryKey: ['articles', user?.id, 'starred'] });

      const previousBookmarks = queryClient.getQueryData(['bookmarks', user?.id]);
      const previousStarredCount = queryClient.getQueryData(['starred-count', user?.id]);
      const previousStarredArticles = queryClient.getQueryData(['articles', user?.id, 'starred']);

      queryClient.setQueryData(['starred-count', user?.id], (old: number = 0) => old + 1);

      return { previousBookmarks, previousStarredCount, previousStarredArticles };
    },
    onError: (err, variables, context: any) => {
      if (context) {
        queryClient.setQueryData(['bookmarks', user?.id], context.previousBookmarks);
        queryClient.setQueryData(['starred-count', user?.id], context.previousStarredCount);
        queryClient.setQueryData(['articles', user?.id, 'starred'], context.previousStarredArticles);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['starred-count', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['articles', user?.id, 'starred'] });
    },
  });
}

/**
 * Hook to unbookmark an article with optimistic update
 */
export function useUnbookmarkArticle() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useViewModelAction({
    mutationFn: (articleId: string) => unbookmarkArticle(articleId),
    successMessage: '已取消收藏',
    onMutate: async (articleId) => {
      await queryClient.cancelQueries({ queryKey: ['bookmarks', user?.id] });
      await queryClient.cancelQueries({ queryKey: ['starred-count', user?.id] });
      await queryClient.cancelQueries({ queryKey: ['articles', user?.id, 'starred'] });

      const previousBookmarks = queryClient.getQueryData(['bookmarks', user?.id]);
      const previousStarredCount = queryClient.getQueryData(['starred-count', user?.id]);
      const previousStarredArticles = queryClient.getQueryData<any[]>(['articles', user?.id, 'starred']);

      queryClient.setQueryData(['starred-count', user?.id], (old: number = 0) => Math.max(0, old - 1));

      if (previousStarredArticles) {
        queryClient.setQueryData(['articles', user?.id, 'starred'],
          previousStarredArticles.filter(a => a.id !== articleId)
        );
      }

      return { previousBookmarks, previousStarredCount, previousStarredArticles };
    },
    onError: (err, articleId, context: any) => {
      if (context) {
        queryClient.setQueryData(['bookmarks', user?.id], context.previousBookmarks);
        queryClient.setQueryData(['starred-count', user?.id], context.previousStarredCount);
        queryClient.setQueryData(['articles', user?.id, 'starred'], context.previousStarredArticles);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['starred-count', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['articles', user?.id, 'starred'] });
    },
  });
}

/**
 * Hook to save article for later with optimistic update
 */
export function useSaveForLater() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useViewModelAction({
    mutationFn: ({ articleId }: { articleId: string }) => saveForLater(articleId),
    successMessage: '已加入稍后阅读',
    onMutate: async ({ articleId }) => {
      await queryClient.cancelQueries({ queryKey: ['read-later', user?.id] });
      await queryClient.cancelQueries({ queryKey: ['later-count', user?.id] });
      await queryClient.cancelQueries({ queryKey: ['articles', user?.id, 'later'] });

      const previousReadLater = queryClient.getQueryData(['read-later', user?.id]);
      const previousLaterCount = queryClient.getQueryData(['later-count', user?.id]);
      const previousLaterArticles = queryClient.getQueryData(['articles', user?.id, 'later']);

      queryClient.setQueryData(['later-count', user?.id], (old: number = 0) => old + 1);

      return { previousReadLater, previousLaterCount, previousLaterArticles };
    },
    onError: (err, variables, context: any) => {
      if (context) {
        queryClient.setQueryData(['read-later', user?.id], context.previousReadLater);
        queryClient.setQueryData(['later-count', user?.id], context.previousLaterCount);
        queryClient.setQueryData(['articles', user?.id, 'later'], context.previousLaterArticles);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['read-later', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['later-count', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['articles', user?.id, 'later'] });
    },
  });
}

/**
 * Hook to remove article from read later with optimistic update
 */
export function useRemoveFromLater() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useViewModelAction({
    mutationFn: (articleId: string) => removeFromLater(articleId),
    successMessage: '已从稍后阅读移除',
    onMutate: async (articleId) => {
      await queryClient.cancelQueries({ queryKey: ['read-later', user?.id] });
      await queryClient.cancelQueries({ queryKey: ['later-count', user?.id] });
      await queryClient.cancelQueries({ queryKey: ['articles', user?.id, 'later'] });

      const previousReadLater = queryClient.getQueryData(['read-later', user?.id]);
      const previousLaterCount = queryClient.getQueryData(['later-count', user?.id]);
      const previousLaterArticles = queryClient.getQueryData<any[]>(['articles', user?.id, 'later']);

      queryClient.setQueryData(['later-count', user?.id], (old: number = 0) => Math.max(0, old - 1));

      if (previousLaterArticles) {
        queryClient.setQueryData(['articles', user?.id, 'later'],
          previousLaterArticles.filter(a => a.id !== articleId)
        );
      }

      return { previousReadLater, previousLaterCount, previousLaterArticles };
    },
    onError: (err, articleId, context: any) => {
      if (context) {
        queryClient.setQueryData(['read-later', user?.id], context.previousReadLater);
        queryClient.setQueryData(['later-count', user?.id], context.previousLaterCount);
        queryClient.setQueryData(['articles', user?.id, 'later'], context.previousLaterArticles);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['read-later', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['later-count', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['articles', user?.id, 'later'] });
    },
  });
}
