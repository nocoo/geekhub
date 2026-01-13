/**
 * @file FeedFetchContext.test.tsx
 * Tests for FeedFetchContext.
 */

import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { renderHook, act, cleanup } from '@testing-library/react';
import { FeedFetchProvider, useFeedFetch } from './FeedFetchContext';
import React, { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test/test-utils';

// Mock dependencies
const mockUseSSEEvents = mock(() => { });

mock.module('./SSEContext', () => ({
    useFeedFetchEvents: mockUseSSEEvents,
}));

mock.module('./AuthContext', () => ({
    useAuth: () => ({ user: { id: 'user-123' } }),
}));

describe('FeedFetchContext', () => {
    let queryClient: QueryClient;

    afterEach(cleanup);
    beforeEach(() => {
        mockUseSSEEvents.mockClear();
        queryClient = createTestQueryClient();
        // Spy on invalidateQueries
        queryClient.invalidateQueries = mock(() => Promise.resolve()) as any;
    });

    it('should manage fetching state', () => {
        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                <FeedFetchProvider>
                    {children}
                </FeedFetchProvider>
            </QueryClientProvider>
        );

        const { result } = renderHook(() => useFeedFetch(), { wrapper });

        expect(result.current.isFeedFetching('feed-1')).toBe(false);

        act(() => {
            result.current.setFetchingFeeds(new Set(['feed-1']));
        });

        expect(result.current.isFeedFetching('feed-1')).toBe(true);
        expect(result.current.fetchingFeeds.has('feed-1')).toBe(true);
    });

    it('should handle fetch complete event via SSE', async () => {
        // Capture the callback passed to useSSEEvents
        let fetchCompleteCallback: any;
        mockUseSSEEvents.mockImplementation((options: any) => {
            fetchCompleteCallback = options.onFetchComplete;
        });

        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                <FeedFetchProvider>
                    {children}
                </FeedFetchProvider>
            </QueryClientProvider>
        );

        const { result } = renderHook(() => useFeedFetch(), { wrapper });

        // Simulate feed being fetched
        act(() => {
            result.current.setFetchingFeeds(new Set(['feed-1']));
        });
        expect(result.current.isFeedFetching('feed-1')).toBe(true);

        // Trigger SSE event
        expect(fetchCompleteCallback).toBeDefined();
        act(() => {
            fetchCompleteCallback({ feedId: 'feed-1' });
        });

        // Should be removed from fetching set
        expect(result.current.isFeedFetching('feed-1')).toBe(false);

        // Should invalidate queries
        expect(queryClient.invalidateQueries).toHaveBeenCalled();
    });
});
