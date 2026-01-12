/**
 * @file useArticleActions.ts
 * React hooks for article actions with optimistic updates.
 * Following MVVM pattern - components use these hooks, not direct API calls.
 */

"use client";

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { fetchFullContent, translateContent, bookmarkArticle, unbookmarkArticle, saveForLater, removeFromLater } from '@/lib/article-actions';
import { Article } from '@/hooks/useDatabase';
import { AISettings } from '@/lib/settings';
import { toast } from '@/components/ui/sonner';

/**
 * Hook to fetch full article content
 */
export function useFetchFullContent() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ articleId, url }: { articleId: string; url: string }) =>
      fetchFullContent(articleId, url),
    onSuccess: (content) => {
      return content;
    },
    onError: () => {
      toast.error('获取全文失败');
    },
  });
}

/**
 * Hook to translate article content
 */
export function useTranslateContent() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ articleId, content, aiSettings }: { articleId: string; content: string; aiSettings: AISettings }) =>
      translateContent(articleId, content, aiSettings),
    onSuccess: () => {
      toast.success('翻译完成');
    },
    onError: () => {
      toast.error('翻译失败');
    },
  });
}

/**
 * Hook to bookmark an article with optimistic update
 */
export function useBookmarkArticle() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ articleId, notes }: { articleId: string; notes?: string }) =>
      bookmarkArticle(articleId, notes),
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
    onError: (err, variables, context) => {
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

  return useMutation({
    mutationFn: (articleId: string) => unbookmarkArticle(articleId),
    onMutate: async (articleId) => {
      await queryClient.cancelQueries({ queryKey: ['bookmarks', user?.id] });
      await queryClient.cancelQueries({ queryKey: ['starred-count', user?.id] });
      await queryClient.cancelQueries({ queryKey: ['articles', user?.id, 'starred'] });

      const previousBookmarks = queryClient.getQueryData(['bookmarks', user?.id]);
      const previousStarredCount = queryClient.getQueryData(['starred-count', user?.id]);
      const previousStarredArticles = queryClient.getQueryData(['articles', user?.id, 'starred']);

      queryClient.setQueryData(['starred-count', user?.id], (old: number = 0) => Math.max(0, old - 1));

      return { previousBookmarks, previousStarredCount, previousStarredArticles };
    },
    onError: (err, articleId, context) => {
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

  return useMutation({
    mutationFn: ({ articleId }: { articleId: string }) => saveForLater(articleId),
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
    onError: (err, variables, context) => {
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

  return useMutation({
    mutationFn: (articleId: string) => removeFromLater(articleId),
    onMutate: async (articleId) => {
      await queryClient.cancelQueries({ queryKey: ['read-later', user?.id] });
      await queryClient.cancelQueries({ queryKey: ['later-count', user?.id] });
      await queryClient.cancelQueries({ queryKey: ['articles', user?.id, 'later'] });

      const previousReadLater = queryClient.getQueryData(['read-later', user?.id]);
      const previousLaterCount = queryClient.getQueryData(['later-count', user?.id]);
      const previousLaterArticles = queryClient.getQueryData(['articles', user?.id, 'later']);

      queryClient.setQueryData(['later-count', user?.id], (old: number = 0) => Math.max(0, old - 1));

      return { previousReadLater, previousLaterCount, previousLaterArticles };
    },
    onError: (err, articleId, context) => {
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
