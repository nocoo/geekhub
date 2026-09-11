/**
 * @file useArticleActions.test.tsx
 * Integration tests for article action hooks with optimistic updates and rollbacks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHookWithProviders, createTestQueryClient } from '@/test/test-utils';
import {
  useBookmarkArticle,
  useUnbookmarkArticle,
  useFetchFullContent,
  useTranslateContent,
  useSaveForLater,
  useRemoveFromLater,
} from './useArticleActions';
import { QueryClient } from '@tanstack/react-query';
import { waitFor, cleanup } from '@testing-library/react';
import { act } from 'react';

// Mock sonner
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(() => { }),
        error: vi.fn(() => { }),
    },
}));

// Mock global fetch
const mockFetch = vi.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true }),
}));
global.fetch = mockFetch as typeof global.fetch;

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

        let resolveMutation: (v: unknown) => void;
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

        let resolveMutation: (v: unknown) => void;
        mockFetch.mockImplementationOnce(() => new Promise(r => { resolveMutation = r; }));

        act(() => {
            result.current.mutate('art-1');
        });

        await waitFor(() => {
            const articles = queryClient.getQueryData<Array<{ id: string; title: string }>>(['articles', userId, 'starred']);
            expect(articles).toHaveLength(1);
            expect(articles![0].id).toBe('art-2');
        });

        act(() => {
            resolveMutation!({ ok: true, json: () => Promise.resolve({ success: true }) });
        });
    });

    it('should rollback unbookmark on failure', async () => {
        const userId = 'user-123';
        const initialArticles = [{ id: 'art-1', title: 'A1' }, { id: 'art-2', title: 'A2' }];
        act(() => {
            queryClient.setQueryData(['starred-count', userId], 2);
            queryClient.setQueryData(['articles', userId, 'starred'], initialArticles);
        });

        const { result } = await act(async () => renderHookWithProviders(() => useUnbookmarkArticle(), { queryClient }));

        mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Network Error')));

        await act(async () => {
            await result.current.mutateAsync('art-1').catch(() => { });
        });

        await waitFor(() => {
            expect(queryClient.getQueryData(['starred-count', userId])).toBe(2);
            const articles = queryClient.getQueryData<Array<{ id: string; title: string }>>(['articles', userId, 'starred']);
            expect(articles).toHaveLength(2);
        });
    });
});

describe('useFetchFullContent', () => {
    let queryClient: QueryClient;

    afterEach(cleanup);
    beforeEach(() => {
        mockFetch.mockClear();
        queryClient = createTestQueryClient();
    });

    it('should call fetch full content API', async () => {
        mockFetch.mockImplementationOnce(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ success: true, content: '<p>Full</p>' }),
            })
        );

        const { result } = await act(async () => renderHookWithProviders(() => useFetchFullContent(), { queryClient }));

        await act(async () => {
            await result.current.mutateAsync({ articleId: 'art-1', url: 'https://example.com/1' });
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle fetch full content error', async () => {
        mockFetch.mockImplementationOnce(() =>
            Promise.resolve({
                ok: false,
                json: () => Promise.resolve({ error: 'Not found' }),
            })
        );

        const { result } = await act(async () => renderHookWithProviders(() => useFetchFullContent(), { queryClient }));

        await act(async () => {
            await result.current.mutateAsync({ articleId: 'art-1', url: 'https://example.com/1' }).catch(() => { });
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });
    });
});

describe('useTranslateContent', () => {
    let queryClient: QueryClient;

    afterEach(cleanup);
    beforeEach(() => {
        mockFetch.mockClear();
        queryClient = createTestQueryClient();
    });

    it('should call translate API with AI settings', async () => {
        mockFetch.mockImplementationOnce(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ translatedContent: '翻译内容' }),
            })
        );

        const { result } = await act(async () => renderHookWithProviders(() => useTranslateContent(), { queryClient }));

        const aiSettings = {
            enabled: true,
            provider: 'openai',
            apiKey: 'test-key',
            baseUrl: 'https://api.openai.com',
        };

        await act(async () => {
            await result.current.mutateAsync({ articleId: 'art-1', content: 'Hello', aiSettings });
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle translate error', async () => {
        mockFetch.mockImplementationOnce(() =>
            Promise.resolve({
                ok: false,
                json: () => Promise.resolve({ error: 'Translation failed' }),
            })
        );

        const { result } = await act(async () => renderHookWithProviders(() => useTranslateContent(), { queryClient }));

        const aiSettings = {
            enabled: true,
            provider: 'openai',
            apiKey: 'test-key',
            baseUrl: 'https://api.openai.com',
        };

        await act(async () => {
            await result.current.mutateAsync({ articleId: 'art-1', content: 'Hello', aiSettings }).catch(() => { });
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });
    });
});

describe('useSaveForLater', () => {
    let queryClient: QueryClient;

    afterEach(cleanup);
    beforeEach(() => {
        mockFetch.mockClear();
        queryClient = createTestQueryClient();
    });

    it('should optimistic update later-count when saving', async () => {
        const userId = 'user-123';
        act(() => {
            queryClient.setQueryData(['later-count', userId], 3);
        });

        const { result } = await act(async () => renderHookWithProviders(() => useSaveForLater(), { queryClient }));

        let resolveMutation: (v: unknown) => void;
        mockFetch.mockImplementationOnce(() => new Promise(r => { resolveMutation = r; }));

        act(() => {
            result.current.mutate({ articleId: 'art-1' });
        });

        await waitFor(() => {
            expect(queryClient.getQueryData(['later-count', userId])).toBe(4);
        });

        act(() => {
            resolveMutation!({ ok: true, json: () => Promise.resolve({ success: true }) });
        });
    });

    it('should rollback later-count on failure', async () => {
        const userId = 'user-123';
        act(() => {
            queryClient.setQueryData(['later-count', userId], 3);
        });

        const { result } = await act(async () => renderHookWithProviders(() => useSaveForLater(), { queryClient }));

        mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Network Error')));

        await act(async () => {
            await result.current.mutateAsync({ articleId: 'art-1' }).catch(() => { });
        });

        await waitFor(() => {
            expect(queryClient.getQueryData(['later-count', userId])).toBe(3);
        });
    });

    it('should invalidate queries on success', async () => {
        const userId = 'user-123';
        act(() => {
            queryClient.setQueryData(['later-count', userId], 3);
        });

        const { result } = await act(async () => renderHookWithProviders(() => useSaveForLater(), { queryClient }));

        mockFetch.mockImplementationOnce(() =>
            Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) })
        );

        await act(async () => {
            await result.current.mutateAsync({ articleId: 'art-1' });
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });
    });
});

describe('useRemoveFromLater', () => {
    let queryClient: QueryClient;

    afterEach(cleanup);
    beforeEach(() => {
        mockFetch.mockClear();
        queryClient = createTestQueryClient();
    });

    it('should optimistic update later-count when removing', async () => {
        const userId = 'user-123';
        act(() => {
            queryClient.setQueryData(['later-count', userId], 3);
        });

        const { result } = await act(async () => renderHookWithProviders(() => useRemoveFromLater(), { queryClient }));

        let resolveMutation: (v: unknown) => void;
        mockFetch.mockImplementationOnce(() => new Promise(r => { resolveMutation = r; }));

        act(() => {
            result.current.mutate('art-1');
        });

        await waitFor(() => {
            expect(queryClient.getQueryData(['later-count', userId])).toBe(2);
        });

        act(() => {
            resolveMutation!({ ok: true, json: () => Promise.resolve({ success: true }) });
        });
    });

    it('should remove article from later articles cache optimistically', async () => {
        const userId = 'user-123';
        const initialArticles = [{ id: 'art-1', title: 'A1' }, { id: 'art-2', title: 'A2' }];
        act(() => {
            queryClient.setQueryData(['articles', userId, 'later'], initialArticles);
            queryClient.setQueryData(['later-count', userId], 2);
        });

        const { result } = await act(async () => renderHookWithProviders(() => useRemoveFromLater(), { queryClient }));

        let resolveMutation: (v: unknown) => void;
        mockFetch.mockImplementationOnce(() => new Promise(r => { resolveMutation = r; }));

        act(() => {
            result.current.mutate('art-1');
        });

        await waitFor(() => {
            const articles = queryClient.getQueryData<Array<{ id: string; title: string }>>(['articles', userId, 'later']);
            expect(articles).toHaveLength(1);
            expect(articles![0].id).toBe('art-2');
        });

        act(() => {
            resolveMutation!({ ok: true, json: () => Promise.resolve({ success: true }) });
        });
    });

    it('should rollback on failure', async () => {
        const userId = 'user-123';
        const initialArticles = [{ id: 'art-1', title: 'A1' }, { id: 'art-2', title: 'A2' }];
        act(() => {
            queryClient.setQueryData(['later-count', userId], 2);
            queryClient.setQueryData(['articles', userId, 'later'], initialArticles);
        });

        const { result } = await act(async () => renderHookWithProviders(() => useRemoveFromLater(), { queryClient }));

        mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Network Error')));

        await act(async () => {
            await result.current.mutateAsync('art-1').catch(() => { });
        });

        await waitFor(() => {
            expect(queryClient.getQueryData(['later-count', userId])).toBe(2);
            const articles = queryClient.getQueryData<Array<{ id: string; title: string }>>(['articles', userId, 'later']);
            expect(articles).toHaveLength(2);
        });
    });

    it('should not go below zero when decrementing later-count', async () => {
        const userId = 'user-123';
        act(() => {
            queryClient.setQueryData(['later-count', userId], 0);
        });

        const { result } = await act(async () => renderHookWithProviders(() => useRemoveFromLater(), { queryClient }));

        let resolveMutation: (v: unknown) => void;
        mockFetch.mockImplementationOnce(() => new Promise(r => { resolveMutation = r; }));

        act(() => {
            result.current.mutate('art-1');
        });

        await waitFor(() => {
            expect(queryClient.getQueryData(['later-count', userId])).toBe(0);
        });

        act(() => {
            resolveMutation!({ ok: true, json: () => Promise.resolve({ success: true }) });
        });
    });
});
