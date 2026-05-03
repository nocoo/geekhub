/**
 * @file FeedFetchContext.test.tsx
 * Tests for FeedFetchContext.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { FeedFetchProvider, useFeedFetch } from './FeedFetchContext';
import React, { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test/test-utils';

// Mock dependencies
const { mockUseSSEEvents } = vi.hoisted(() => ({
    mockUseSSEEvents: vi.fn(() => { }),
}));

vi.mock('./SSEContext', () => ({
    useFeedFetchEvents: mockUseSSEEvents,
}));

vi.mock('./AuthContext', () => ({
    useAuth: () => ({ user: { id: 'user-123' } }),
}));

describe('FeedFetchContext', () => {
    let queryClient: QueryClient;

    afterEach(cleanup);
    beforeEach(() => {
        mockUseSSEEvents.mockClear();
        queryClient = createTestQueryClient();
        // Spy on invalidateQueries
        queryClient.invalidateQueries = vi.fn(() => Promise.resolve()) as typeof queryClient.invalidateQueries;
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
        let fetchCompleteCallback: ((data: { feedId: string }) => void) | undefined;
        mockUseSSEEvents.mockImplementation((options: { onFetchComplete?: (data: { feedId: string }) => void }) => {
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
            fetchCompleteCallback!({ feedId: 'feed-1' });
        });

        // Should be removed from fetching set
        expect(result.current.isFeedFetching('feed-1')).toBe(false);

        // Should invalidate queries
        expect(queryClient.invalidateQueries).toHaveBeenCalled();
    });
});
