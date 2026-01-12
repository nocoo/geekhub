/**
 * useFeedViewModels
 *
 * Centralized hook for fetching and managing feed view models.
 * All feed data should be accessed through this hook to ensure consistency.
 */

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useFeedFetch } from "@/contexts/FeedFetchContext";
import { FeedViewModel, FeedGroupViewModel, CategoryViewModel } from "@/types/feed-view-model";

// Raw API response type
interface FeedApiResponse {
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
  unread_count: number;
  total_articles: number;
  last_fetch_at: string | null;
  last_fetch_status: string | null;
  next_fetch_at: string | null;
  created_at: string;
  updated_at: string;
  category?: {
    id: string;
    name: string;
    icon: string;
    color: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
  };
}

// Fetch feeds from API
async function fetchFeeds(): Promise<FeedViewModel[]> {
  const response = await fetch("/api/feeds/list");
  if (!response.ok) {
    throw new Error("Failed to fetch feeds");
  }
  const data = await response.json();
  return (data.feeds as FeedApiResponse[]).map(transformToViewModel);
}

// Transform API response to ViewModel (exported for testing)
export function transformToViewModel(feed: FeedApiResponse): FeedViewModel {
  return {
    id: feed.id,
    title: feed.title,
    url: feed.url,
    urlHash: feed.url_hash,
    categoryId: feed.category_id,
    categoryName: feed.category?.name,
    categoryIcon: feed.category?.icon,
    categoryColor: feed.category?.color,
    faviconUrl: feed.favicon_url,
    description: feed.description,
    isActive: feed.is_active,
    autoTranslate: feed.auto_translate,
    totalArticles: feed.total_articles,
    unreadCount: feed.unread_count,
    isFetching: false, // Will be updated by context
    lastFetchAt: feed.last_fetch_at,
    lastFetchStatus: feed.last_fetch_status,
    nextFetchAt: feed.next_fetch_at,
    createdAt: feed.created_at,
    updatedAt: feed.updated_at,
  };
}

/**
 * Hook to get all feeds as ViewModels
 *
 * @param options - Query options
 * @returns Query result with feed ViewModels
 */
export function useFeedViewModels() {
  const { user } = useAuth();
  const { fetchingFeeds } = useFeedFetch();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["feedViewModels", user?.id],
    queryFn: fetchFeeds,
    enabled: !!user,
    staleTime: 5 * 1000, // 5 seconds
  });

  // Inject isFetching state from context
  const feedsWithFetchingState = query.data?.map((feed) => ({
    ...feed,
    isFetching: fetchingFeeds.has(feed.id),
  }));

  return {
    ...query,
    data: feedsWithFetchingState,
  };
}

/**
 * Hook to get feeds grouped by category
 *
 * @param options - Query options
 * @returns Query result with grouped feed ViewModels
 */
export function useFeedGroups() {
  const { data: feeds, ...query } = useFeedViewModels();

  if (!feeds) {
    return { ...query, data: undefined };
  }

  // Group by category
  const grouped = new Map<string, FeedViewModel[]>();
  const uncategorized: FeedViewModel[] = [];

  for (const feed of feeds) {
    if (feed.categoryId) {
      const group = grouped.get(feed.categoryId) || [];
      group.push(feed);
      grouped.set(feed.categoryId, group);
    } else {
      uncategorized.push(feed);
    }
  }

  // Build category view models
  const categories: CategoryViewModel[] = [];
  const groups: FeedGroupViewModel[] = [];

  // Process categorized feeds
  for (const [categoryId, categoryFeeds] of grouped) {
    const firstFeed = categoryFeeds[0];
    const category: CategoryViewModel = {
      id: categoryId,
      name: firstFeed.categoryName || "Unknown",
      icon: firstFeed.categoryIcon || "📁",
      color: firstFeed.categoryColor || "#6b7280",
      sortOrder: 0,
      feedCount: categoryFeeds.length,
      unreadCount: categoryFeeds.reduce((sum, f) => sum + f.unreadCount, 0),
    };
    categories.push(category);
    groups.push({
      category,
      feeds: categoryFeeds,
      totalUnreadCount: category.unreadCount || 0,
    });
  }

  // Add uncategorized group
  if (uncategorized.length > 0) {
    groups.push({
      category: null,
      feeds: uncategorized,
      totalUnreadCount: uncategorized.reduce((sum, f) => sum + f.unreadCount, 0),
    });
  }

  // Sort groups by category name (null category last)
  groups.sort((a, b) => {
    if (!a.category) return 1;
    if (!b.category) return -1;
    return a.category.name.localeCompare(b.category.name);
  });

  return {
    ...query,
    data: groups,
    categories,
  };
}

/**
 * Hook to get a single feed by ID
 */
export function useFeedViewModel(feedId: string | null) {
  const { data: feeds, isLoading } = useFeedViewModels();

  if (!feedId) {
    return null;
  }

  // If still loading and no cached data, return null
  if (isLoading && !feeds) {
    return null;
  }

  // Return the feed from cached data
  return feeds?.find((feed) => feed.id === feedId) || null;
}

/**
 * Hook to refresh feeds (manual refresh)
 */
export function useRefreshFeeds() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return () => {
    queryClient.invalidateQueries({ queryKey: ["feedViewModels", user?.id] });
  };
}

/**
 * Hook to get total unread count across all feeds
 */
export function useTotalUnreadCount() {
  const { data: feeds } = useFeedViewModels();

  if (!feeds) {
    return 0;
  }

  return feeds.reduce((sum, feed) => sum + feed.unreadCount, 0);
}
