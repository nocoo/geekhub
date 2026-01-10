"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase-browser';
import { useAuth } from '@/contexts/AuthContext';

const supabase = createClient();

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Feed {
  id: string;
  user_id: string;
  title: string;
  url: string;
  url_hash?: string;
  category_id: string | null;
  favicon_url: string | null;
  description: string | null;
  is_active: boolean;
  fetch_interval_minutes: number;
  unread_count?: number;
  total_articles?: number;
  last_fetched_at: string | null;
  created_at: string;
  updated_at: string;
  category?: Category;
}

export interface Article {
  id: string;
  feedId: string;
  title: string;
  url: string;
  description: string;
  content?: string;
  author?: string;
  publishedAt?: Date | null;
  feedName: string;
  feedIcon: string;
  isRead: boolean;
  hash?: string;
  image?: string | null;
}

// Categories hooks
export function useCategories() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['categories', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Category[];
    },
    enabled: !!user,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (category: { name: string; color?: string; icon?: string }) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('categories')
        .insert({
          user_id: user.id,
          name: category.name,
          color: category.color || '#10b981',
          icon: category.icon || '📁',
        })
        .select()
        .single();

      if (error) throw error;
      return data as Category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', user?.id] });
    },
  });
}

// Feeds hooks
export function useFeeds() {
  const { user } = useAuth();

  const result = useQuery({
    queryKey: ['feeds', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const response = await fetch('/api/feeds/list');
      if (!response.ok) {
        throw new Error('Failed to load feeds');
      }

      const { feeds } = await response.json();
      return feeds as Feed[];
    },
    enabled: !!user,
  });

  return result;
}

export function useCreateFeed() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (feed: {
      title: string;
      url: string;
      category_id?: string;
      description?: string;
    }) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('feeds')
        .insert({
          user_id: user.id,
          title: feed.title,
          url: feed.url,
          category_id: feed.category_id,
          description: feed.description,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Feed;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeds', user?.id] });
    },
  });
}

// Articles hooks
export function useArticles(feedId?: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['articles', user?.id, feedId],
    queryFn: async () => {
      if (!user) return [];

      if (!feedId) {
        // 如果没有选择 feed，返回空数组或所有文章
        return [];
      }

      const response = await fetch(`/api/feeds/${feedId}/articles`);
      if (!response.ok) {
        throw new Error('Failed to load articles');
      }

      const data = await response.json();
      return data.articles as Article[];
    },
    enabled: !!user && !!feedId,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ articleHash, feedId }: { articleHash: string; feedId: string }) => {
      const response = await fetch(`/api/articles/${articleHash}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedId }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark article as read');
      }

      return await response.json();
    },
    onMutate: async ({ articleHash, feedId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['articles', user?.id] });
      await queryClient.cancelQueries({ queryKey: ['feeds', user?.id] });

      // Snapshot previous values
      const previousArticles = queryClient.getQueryData<Article[]>(['articles', user?.id, feedId]);
      const previousFeeds = queryClient.getQueryData<Feed[]>(['feeds', user?.id]);

      // Optimistically update articles
      queryClient.setQueryData<Article[]>(['articles', user?.id, feedId], (old = []) =>
        old.map(article =>
          article.hash === articleHash ? { ...article, isRead: true } : article
        )
      );

      // Optimistically update feed unread count
      queryClient.setQueryData<Feed[]>(['feeds', user?.id], (old = []) =>
        old.map(feed =>
          feed.id === feedId
            ? { ...feed, unread_count: Math.max(0, (feed.unread_count || 0) - 1) }
            : feed
        )
      );

      // Return context for rollback
      return { previousArticles, previousFeeds, feedId };
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousArticles) {
        queryClient.setQueryData(['articles', user?.id, context.feedId], context.previousArticles);
      }
      if (context?.previousFeeds) {
        queryClient.setQueryData(['feeds', user?.id], context.previousFeeds);
      }
    },
    onSettled: (_data, _error, { feedId }) => {
      // Refetch to ensure server state
      queryClient.invalidateQueries({ queryKey: ['articles', user?.id, feedId] });
      queryClient.invalidateQueries({ queryKey: ['feeds', user?.id] });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (feedId: string) => {
      const response = await fetch(`/api/feeds/${feedId}/mark-all-read`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to mark all as read');
      }

      return await response.json();
    },
    onMutate: async (feedId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['articles', user?.id] });
      await queryClient.cancelQueries({ queryKey: ['feeds', user?.id] });

      // Snapshot previous values
      const previousArticles = queryClient.getQueryData<Article[]>(['articles', user?.id, feedId]);
      const previousFeeds = queryClient.getQueryData<Feed[]>(['feeds', user?.id]);

      // Optimistically update all articles as read
      queryClient.setQueryData<Article[]>(['articles', user?.id, feedId], (old = []) =>
        old.map(article => ({ ...article, isRead: true }))
      );

      // Optimistically update feed unread count to 0
      queryClient.setQueryData<Feed[]>(['feeds', user?.id], (old = []) =>
        old.map(feed =>
          feed.id === feedId ? { ...feed, unread_count: 0 } : feed
        )
      );

      // Return context for rollback
      return { previousArticles, previousFeeds };
    },
    onError: (_error, feedId, context) => {
      // Rollback on error
      if (context?.previousArticles) {
        queryClient.setQueryData(['articles', user?.id, feedId], context.previousArticles);
      }
      if (context?.previousFeeds) {
        queryClient.setQueryData(['feeds', user?.id], context.previousFeeds);
      }
    },
    onSettled: (_data, _error, feedId) => {
      // Refetch to ensure server state
      queryClient.invalidateQueries({ queryKey: ['articles', user?.id, feedId] });
      queryClient.invalidateQueries({ queryKey: ['feeds', user?.id] });
    },
  });
}

export function useUpdateArticle() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      id,
      updates
    }: {
      id: string;
      updates: { is_read?: boolean; is_bookmarked?: boolean }
    }) => {
      const { data, error } = await supabase
        .from('articles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Article;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles', user?.id] });
    },
  });
}

// Category mutations
export function useUpdateCategory() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { name?: string; color?: string; icon?: string } }) => {
      const { data, error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['feeds', user?.id] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['feeds', user?.id] });
    },
  });
}

// Feed mutations
export function useUpdateFeed() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, updates }: {
      id: string;
      updates: { title?: string; description?: string; category_id?: string | null; is_active?: boolean; fetch_interval_minutes?: number }
    }) => {
      const { data, error } = await supabase
        .from('feeds')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Feed;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeds', user?.id] });
    },
  });
}

export function useDeleteFeed() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('feeds')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeds', user?.id] });
    },
  });
}
// Bookmark hooks
export function useBookmarkArticle() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ articleHash, feedId, articleTitle, articleUrl }: {
      articleHash: string;
      feedId: string;
      articleTitle: string;
      articleUrl: string;
    }) => {
      const response = await fetch(`/api/articles/${articleHash}/bookmark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedId, articleTitle, articleUrl }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Failed to bookmark article');
      }

      return await response.json();
    },
    onSuccess: () => {
      // Invalidate bookmarks queries
      queryClient.invalidateQueries({ queryKey: ['bookmarks', user?.id] });
    },
  });
}

export function useUnbookmarkArticle() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (articleHash: string) => {
      const response = await fetch(`/api/articles/${articleHash}/bookmark`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Failed to remove bookmark');
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks', user?.id] });
    },
  });
}

// Read Later hooks
export function useSaveForLater() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ articleHash, feedId, articleTitle, articleUrl }: {
      articleHash: string;
      feedId: string;
      articleTitle: string;
      articleUrl: string;
    }) => {
      const response = await fetch(`/api/articles/${articleHash}/read-later`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedId, articleTitle, articleUrl }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Failed to save article');
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['read-later', user?.id] });
    },
  });
}

export function useRemoveFromLater() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (articleHash: string) => {
      const response = await fetch(`/api/articles/${articleHash}/read-later`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Failed to remove article');
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['read-later', user?.id] });
    },
  });
}
