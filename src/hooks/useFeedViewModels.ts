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
import { transformToViewModel, calculateFeedGroups, FeedApiResponse } from "@/lib/view-models/feed-view-model";
import { useMemo } from "react";

// Fetch feeds from API
async function fetchFeeds(): Promise<FeedViewModel[]> {
  const response = await fetch("/api/feeds/list");
  if (!response.ok) {
    throw new Error("Failed to fetch feeds");
  }
  const data = await response.json();
  return (data.feeds as FeedApiResponse[]).map(transformToViewModel);
}

// Re-export for convenience or legacy support if needed
export { transformToViewModel };

/**
 * Hook to get all feeds as ViewModels
 *
 * @param options - Query options
 * @returns Query result with feed ViewModels
 */
export function useFeedViewModels() {
  const { user } = useAuth();
  const { fetchingFeeds } = useFeedFetch();

  const query = useQuery({
    queryKey: ["feedViewModels", user?.id],
    queryFn: fetchFeeds,
    enabled: !!user,
    staleTime: 5 * 1000, // 5 seconds
  });

  // Inject isFetching state from context
  const feedsWithFetchingState = useMemo(() => query.data?.map((feed) => ({
    ...feed,
    isFetching: fetchingFeeds.has(feed.id),
  })), [query.data, fetchingFeeds]);

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
    return { ...query, data: undefined, categories: [] };
  }

  const { groups, categories } = calculateFeedGroups(feeds);

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
