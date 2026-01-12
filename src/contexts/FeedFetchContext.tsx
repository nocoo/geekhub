"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useFeedFetchEvents as useSSEEvents } from './SSEContext';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { fetchFeedWithSettings } from '@/lib/fetch-with-settings';
import { toast } from 'sonner';

interface FeedFetchContextValue {
  fetchingFeeds: Set<string>;
  isFeedFetching: (feedId: string) => boolean;
  fetchFeed: (feedId: string, feedTitle?: string) => Promise<void>;
}

const FeedFetchContext = createContext<FeedFetchContextValue | undefined>(undefined);

export function useFeedFetch() {
  const context = useContext(FeedFetchContext);
  if (!context) {
    throw new Error('useFeedFetch must be used within FeedFetchProvider');
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
      // Unread counts are refreshed via /api/feeds/list on demand
    }, [setFetchingFeeds]),
  });

  const isFeedFetching = useCallback((feedId: string) => {
    return fetchingFeeds.has(feedId);
  }, [fetchingFeeds]);

  const fetchFeed = useCallback(async (feedId: string, feedTitle?: string) => {
    if (fetchingFeeds.has(feedId)) {
      return; // Already fetching
    }

    setFetchingFeeds(prev => new Set(prev).add(feedId));

    try {
      const response = await fetchFeedWithSettings(feedId);

      if (response.ok) {
        toast.success(feedTitle ? `开始抓取「${feedTitle}」` : '正在抓取最新文章...');
        // Fetching state will be reset when fetch-complete event is received
      } else {
        const { error } = await response.json();
        toast.error(error || '抓取失败');
        // Reset fetching state on error
        setFetchingFeeds(prev => {
          const newSet = new Set(prev);
          newSet.delete(feedId);
          return newSet;
        });
      }
    } catch (error) {
      console.error('Failed to fetch feed:', error);
      toast.error('抓取失败');
      // Reset fetching state on error
      setFetchingFeeds(prev => {
        const newSet = new Set(prev);
        newSet.delete(feedId);
        return newSet;
      });
    }
  }, [fetchingFeeds]);

  const value: FeedFetchContextValue = {
    fetchingFeeds,
    isFeedFetching,
    fetchFeed,
  };

  return (
    <FeedFetchContext.Provider value={value}>
      {children}
    </FeedFetchContext.Provider>
  );
}
