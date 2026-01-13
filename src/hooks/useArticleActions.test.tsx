/**
 * @file useArticleActions.test.tsx
 * Integration tests for article action hooks with optimistic updates and rollbacks.
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { renderHookWithProviders, createTestQueryClient } from '@/test/test-utils';
import { useBookmarkArticle, useUnbookmarkArticle } from './useArticleActions';
import { QueryClient } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';

// Mock global fetch
const mockFetch = mock(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true }),
}));
global.fetch = mockFetch as any;

describe('useArticleActions ViewModel Actions', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        mockFetch.mockClear();
        queryClient = createTestQueryClient();
    });

    it('should optimistic update starred-count when bookmarking', async () => {
        const userId = 'user-123';
        queryClient.setQueryData(['starred-count', userId], 5);

        const { result } = renderHookWithProviders(() => useBookmarkArticle(), { queryClient });

        let resolveMutation: (v: any) => void;
        const mutationPromise = new Promise(r => { resolveMutation = r; });
        mockFetch.mockImplementationOnce(() => mutationPromise);

        result.current.mutate({ articleId: 'art-1' });

        // Use waitFor to allow async onMutate to finish
        await waitFor(() => {
            const optimisticCount = queryClient.getQueryData(['starred-count', userId]);
            expect(optimisticCount).toBe(6);
        });

        resolveMutation!({ ok: true, json: () => Promise.resolve({ success: true }) });
        await waitFor(() => {
            expect(queryClient.getQueryData(['starred-count', userId])).toBe(6);
        });
    });

    it('should rollback starred-count on failure', async () => {
        const userId = 'user-123';
        queryClient.setQueryData(['starred-count', userId], 5);

        const { result } = renderHookWithProviders(() => useBookmarkArticle(), { queryClient });

        mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Network Error')));

        await result.current.mutateAsync({ articleId: 'art-1' }).catch(() => { });

        await waitFor(() => {
            const rolledBackCount = queryClient.getQueryData(['starred-count', userId]);
            expect(rolledBackCount).toBe(5);
        });
    });

    it('should remove article from starred articles cache optimistically', async () => {
        const userId = 'user-123';
        const initialArticles = [{ id: 'art-1', title: 'A1' }, { id: 'art-2', title: 'A2' }];
        queryClient.setQueryData(['articles', userId, 'starred'], initialArticles);

        const { result } = renderHookWithProviders(() => useUnbookmarkArticle(), { queryClient });

        let resolveMutation: (v: any) => void;
        mockFetch.mockImplementationOnce(() => new Promise(r => { resolveMutation = r; }));

        result.current.mutate('art-1');

        await waitFor(() => {
            const articles = queryClient.getQueryData<any[]>(['articles', userId, 'starred']);
            expect(articles).toHaveLength(1);
            expect(articles![0].id).toBe('art-2');
        });

        resolveMutation!({ ok: true, json: () => Promise.resolve({ success: true }) });
    });
});
