"use client";

import { createContext, useContext, useState, useCallback, ReactNode, Dispatch, SetStateAction, useMemo } from 'react';
import { useFeedFetchEvents as useSSEEvents } from './SSEContext';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';

/**
 * Feed fetch state context - only manages fetching status
 *
 * Note: The actual fetch action has been moved to useFetchFeed() hook
 * which uses React Query mutation for better state management.
 */
interface FeedFetchStateContextValue {
  fetchingFeeds: Set<string>;
  isFeedFetching: (feedId: string) => boolean;
  setFetchingFeeds: Dispatch<SetStateAction<Set<string>>>;
}

export const FeedFetchContext = createContext<FeedFetchStateContextValue | undefined>(undefined);

export function useFeedFetch() {
  const context = useContext(FeedFetchContext);
  if (!context) {
    throw new Error('useFeedFetch must be used within FeedFetchProvider');
  }
  return context;
}

// Export internal hook for useFeedActions (needs setFetchingFeeds)
export function useFeedFetchInternal() {
  const context = useContext(FeedFetchContext);
  if (!context) {
    throw new Error('useFeedFetchInternal must be used within FeedFetchProvider');
  }
  return context;
}

interface ProviderProps {
  children: ReactNode;
}

export function FeedFetchProvider({ children }: ProviderProps) {
  const [fetchingFeeds, setFetchingFeeds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Listen for SSE fetch completion events
  useSSEEvents({
    onFetchComplete: useCallback((event: { feedId: string }) => {
      setFetchingFeeds(prev => {
        const newSet = new Set(prev);
        newSet.delete(event.feedId);
        return newSet;
      });

      // Invalidate both articles and feed list to update counts
      queryClient.invalidateQueries({ queryKey: ['articles', user?.id, event.feedId] });
      queryClient.invalidateQueries({ queryKey: ['feedViewModels', user?.id] });
    }, [setFetchingFeeds, queryClient, user]),
  });

  const isFeedFetching = useCallback((feedId: string) => {
    return fetchingFeeds.has(feedId);
  }, [fetchingFeeds]);

  const value = useMemo<FeedFetchStateContextValue>(() => ({
    fetchingFeeds,
    isFeedFetching,
    setFetchingFeeds,
  }), [fetchingFeeds, isFeedFetching]);

  return (
    <FeedFetchContext.Provider value={value}>
      {children}
    </FeedFetchContext.Provider>
  );
}
