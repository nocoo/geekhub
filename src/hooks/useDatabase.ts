"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase-browser';
import { useAuth } from '@/contexts/AuthContext';
import { FeedViewModel } from '@/types/feed-view-model';

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
  auto_translate: boolean;
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
  urlHash?: string;
  image?: string | null;
  translatedTitle?: string;
  translatedDescription?: string;
  ai_summary?: {
    content: string;
    model: string;
    generated_at: string;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };
}

export interface Blog {
  id: string;
  name: string;
  url: string;
  feed?: string | null;
  tags?: string[] | null;
  last_updated?: string | null;
  score?: {
    overall?: string;
    [key: string]: string | undefined;
  } | null;
  created_at: string;
  updated_at: string;
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

// Note: useFeeds() has been deprecated in favor of useFeedViewModels() from '@/hooks/useFeedViewModels'
// which provides properly transformed ViewModels with consistent naming conventions

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
      // Unread counts are refreshed via /api/feeds/list on demand
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

      // Handle special feed types
      let apiUrl: string;
      if (feedId === 'starred') {
        apiUrl = '/api/feeds/starred/articles';
      } else if (feedId === 'later') {
        apiUrl = '/api/feeds/later/articles';
      } else {
        apiUrl = `/api/feeds/${feedId}/articles`;
      }

      const response = await fetch(apiUrl);
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
    mutationFn: async ({ articleId, feedId }: { articleId: string; feedId: string }) => {
      const response = await fetch(`/api/articles/${articleId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedId }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark article as read');
      }

      return await response.json();
    },
    onMutate: async ({ articleId, feedId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['articles', user?.id] });

      // Snapshot previous values
      const previousArticles = queryClient.getQueryData<Article[]>(['articles', user?.id, feedId]);
      const previousFeeds = queryClient.getQueryData<FeedViewModel[]>(['feedViewModels', user?.id]);

      // Optimistically update articles
      queryClient.setQueryData<Article[]>(['articles', user?.id, feedId], (old = []) =>
        old.map(article =>
          article.id === articleId ? { ...article, isRead: true } : article
        )
      );

      // Optimistically update feedViewModels unread count (used by Sidebar)
      queryClient.setQueryData<FeedViewModel[]>(['feedViewModels', user?.id], (old = []) =>
        (old || []).map(feed =>
          feed.id === feedId
            ? { ...feed, unreadCount: Math.max(0, (feed.unreadCount || 0) - 1) }
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
        queryClient.setQueryData(['feedViewModels', user?.id], context.previousFeeds);
      }
    },
    onSettled: (_data, error, { feedId }) => {
      // Only refresh feedViewModels on error to restore optimistic update
      // On success, the optimistic update is already correct
      if (error) {
        queryClient.invalidateQueries({ queryKey: ['feedViewModels', user?.id] });
      }
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
      await queryClient.cancelQueries({ queryKey: ['feedViewModels', user?.id] });

      // Snapshot previous values
      const previousArticles = queryClient.getQueryData<Article[]>(['articles', user?.id, feedId]);
      const previousFeeds = queryClient.getQueryData<FeedViewModel[]>(['feedViewModels', user?.id]);

      // Optimistically update all articles as read
      queryClient.setQueryData<Article[]>(['articles', user?.id, feedId], (old = []) =>
        old.map(article => ({ ...article, isRead: true }))
      );

      // Optimistically update feedViewModels unread count to 0 (used by Sidebar)
      queryClient.setQueryData<FeedViewModel[]>(['feedViewModels', user?.id], (old = []) =>
        (old || []).map(feed =>
          feed.id === feedId ? { ...feed, unreadCount: 0 } : feed
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
        queryClient.setQueryData(['feedViewModels', user?.id], context.previousFeeds);
      }
    },
    onSettled: (_data, error, feedId) => {
      // Only refresh feedViewModels on error to restore optimistic update
      // On success, the optimistic update is already correct
      if (error) {
        queryClient.invalidateQueries({ queryKey: ['feedViewModels', user?.id] });
      }
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
      // Unread counts are refreshed via /api/feeds/list on demand
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
      // Unread counts are refreshed via /api/feeds/list on demand
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
      // Unread counts are refreshed via /api/feeds/list on demand
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
      // Unread counts are refreshed via /api/feeds/list on demand
    },
  });
}
// Re-export article actions from useArticleActions for backward compatibility
// These hooks have been moved to useArticleActions.ts for better organization
export {
  useBookmarkArticle,
  useUnbookmarkArticle,
  useSaveForLater,
  useRemoveFromLater,
} from '@/hooks/useArticleActions';

// Get starred articles count
export function useStarredCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['starred-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;

      const response = await fetch('/api/feeds/starred/articles');
      if (!response.ok) {
        throw new Error('Failed to load starred count');
      }

      const data = await response.json();
      return data.total || 0;
    },
    enabled: !!user,
  });
}

// Get later articles count
export function useLaterCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['later-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;

      const response = await fetch('/api/feeds/later/articles');
      if (!response.ok) {
        throw new Error('Failed to load later count');
      }

      const data = await response.json();
      return data.total || 0;
    },
    enabled: !!user,
  });
}

// Blog discovery hooks
export function useBlogs(params: {
  sort?: string;
  tag?: string;
  search?: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
} = {}) {
  return useQuery({
    queryKey: ['blogs', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params.sort) queryParams.set('sort', params.sort);
      if (params.tag) queryParams.set('tag', params.tag);
      if (params.search) queryParams.set('search', params.search);
      if (params.page) queryParams.set('page', params.page.toString());
      if (params.limit) queryParams.set('limit', params.limit.toString());

      const response = await fetch(`/api/blogs?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to load blogs');
      }

      const data = await response.json();
      return data as {
        blogs: Blog[];
        tags: string[];
        pagination: {
          page: number;
          limit: number;
          hasMore: boolean;
        };
      };
    },
    enabled: params.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
