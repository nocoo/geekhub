"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Feed {
  id: string;
  user_id: string;
  title: string;
  url: string;
  category_id: string | null;
  favicon_url: string | null;
  description: string | null;
  last_fetched_at: string | null;
  created_at: string;
  updated_at: string;
  category?: Category;
}

export interface Article {
  id: string;
  feed_id: string;
  title: string;
  content: string | null;
  url: string;
  author: string | null;
  published_at: string;
  is_read: boolean;
  is_bookmarked: boolean;
  created_at: string;
  feed?: Feed;
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
    mutationFn: async (category: { name: string; color?: string }) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('categories')
        .insert({
          user_id: user.id,
          name: category.name,
          color: category.color || '#10b981',
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

  return useQuery({
    queryKey: ['feeds', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('feeds')
        .select(`
          *,
          category:categories(*)
        `)
        .order('title');

      if (error) throw error;
      return data as Feed[];
    },
    enabled: !!user,
  });
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
export function useArticles(feedId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['articles', user?.id, feedId],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('articles')
        .select(`
          *,
          feed:feeds(*)
        `)
        .order('published_at', { ascending: false });

      if (feedId) {
        query = query.eq('feed_id', feedId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Article[];
    },
    enabled: !!user,
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