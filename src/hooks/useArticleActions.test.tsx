/**
 * @file useArticleActions.test.tsx
 * Integration tests for article action hooks with optimistic updates and rollbacks.
 */

import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { renderHookWithProviders, createTestQueryClient } from '@/test/test-utils';
import { useBookmarkArticle, useUnbookmarkArticle } from './useArticleActions';
import { QueryClient } from '@tanstack/react-query';
import { waitFor, cleanup } from '@testing-library/react';
import { act } from 'react';

// Mock sonner
mock.module('sonner', () => ({
    toast: {
        success: mock(() => { }),
        error: mock(() => { }),
    },
}));

// Mock global fetch
const mockFetch = mock(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true }),
}));
global.fetch = mockFetch as any;

describe('useArticleActions ViewModel Actions', () => {
    let queryClient: QueryClient;

    afterEach(cleanup);
    beforeEach(() => {
        mockFetch.mockClear();
        queryClient = createTestQueryClient();
    });

    it('should optimistic update starred-count when bookmarking', async () => {
        const userId = 'user-123';
        act(() => {
            queryClient.setQueryData(['starred-count', userId], 5);
        });

        const { result } = await act(async () => renderHookWithProviders(() => useBookmarkArticle(), { queryClient }));

        let resolveMutation: (v: any) => void;
        const mutationPromise = new Promise(r => { resolveMutation = r; });
        mockFetch.mockImplementationOnce(() => mutationPromise);

        act(() => {
            result.current.mutate({ articleId: 'art-1' });
        });

        // Use waitFor to allow async onMutate to finish
        await waitFor(() => {
            const optimisticCount = queryClient.getQueryData(['starred-count', userId]);
            expect(optimisticCount).toBe(6);
        });

        act(() => {
            resolveMutation!({ ok: true, json: () => Promise.resolve({ success: true }) });
        });

        await waitFor(() => {
            expect(queryClient.getQueryData(['starred-count', userId])).toBe(6);
        });
    });

    it('should rollback starred-count on failure', async () => {
        const userId = 'user-123';
        act(() => {
            queryClient.setQueryData(['starred-count', userId], 5);
        });

        const { result } = await act(async () => renderHookWithProviders(() => useBookmarkArticle(), { queryClient }));

        mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Network Error')));

        await act(async () => {
            await result.current.mutateAsync({ articleId: 'art-1' }).catch(() => { });
        });

        await waitFor(() => {
            const rolledBackCount = queryClient.getQueryData(['starred-count', userId]);
            expect(rolledBackCount).toBe(5);
        });
    });

    it('should remove article from starred articles cache optimistically', async () => {
        const userId = 'user-123';
        const initialArticles = [{ id: 'art-1', title: 'A1' }, { id: 'art-2', title: 'A2' }];
        act(() => {
            queryClient.setQueryData(['articles', userId, 'starred'], initialArticles);
        });

        const { result } = await act(async () => renderHookWithProviders(() => useUnbookmarkArticle(), { queryClient }));

        let resolveMutation: (v: any) => void;
        mockFetch.mockImplementationOnce(() => new Promise(r => { resolveMutation = r; }));

        act(() => {
            result.current.mutate('art-1');
        });

        await waitFor(() => {
            const articles = queryClient.getQueryData<any[]>(['articles', userId, 'starred']);
            expect(articles).toHaveLength(1);
            expect(articles![0].id).toBe('art-2');
        });

        act(() => {
            resolveMutation!({ ok: true, json: () => Promise.resolve({ success: true }) });
        });
    });
});
