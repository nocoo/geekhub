/**
 * @file feed-view-model.test.ts
 * Unit tests for pure logic in FeedViewModel lib
 */

import { describe, it, expect } from 'bun:test';
import { transformToViewModel, calculateFeedGroups, FeedApiResponse } from './feed-view-model';
import { FeedViewModel } from '@/types/feed-view-model';

describe('FeedViewModel Library Logic', () => {
    const mockApiResponse: FeedApiResponse = {
        id: 'feed-1',
        user_id: 'user-1',
        title: 'Test Feed',
        url: 'https://example.com/feed.xml',
        url_hash: 'abc123',
        category_id: 'cat-1',
        favicon_url: 'https://example.com/icon.png',
        description: 'Description',
        is_active: true,
        fetch_interval_minutes: 30,
        auto_translate: false,
        unread_count: 5,
        total_articles: 10,
        last_fetch_at: '2026-01-13T00:00:00Z',
        last_fetch_status: 'success',
        next_fetch_at: '2026-01-13T00:30:00Z',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-13T00:00:00Z',
        category: {
            id: 'cat-1',
            name: 'Technology',
            icon: '💻',
            color: '#000',
            sort_order: 1,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
        }
    };

    describe('transformToViewModel', () => {
        it('should correctly map API fields to camelCase ViewModel fields', () => {
            const vm = transformToViewModel(mockApiResponse);

            expect(vm.id).toBe(mockApiResponse.id);
            expect(vm.title).toBe(mockApiResponse.title);
            expect(vm.urlHash).toBe(mockApiResponse.url_hash);
            expect(vm.categoryId).toBe(mockApiResponse.category_id);
            expect(vm.categoryName).toBe(mockApiResponse.category?.name);
            expect(vm.unreadCount).toBe(5);
            expect(vm.isFetching).toBe(false);
        });

        it('should handle null categories', () => {
            const apiNoCat = { ...mockApiResponse, category_id: null, category: undefined };
            const vm = transformToViewModel(apiNoCat);

            expect(vm.categoryId).toBeNull();
            expect(vm.categoryName).toBeUndefined();
        });
    });

    describe('calculateFeedGroups', () => {
        const feeds: FeedViewModel[] = [
            {
                id: '1', title: 'F1', url: '', categoryId: 'c1', categoryName: 'Cat 1',
                unreadCount: 2, totalArticles: 5, isActive: true, autoTranslate: false,
                isFetching: false, createdAt: '', updatedAt: '', faviconUrl: null, description: null,
                lastFetchAt: null, lastFetchStatus: null, nextFetchAt: null
            },
            {
                id: '2', title: 'F2', url: '', categoryId: 'c1', categoryName: 'Cat 1',
                unreadCount: 3, totalArticles: 5, isActive: true, autoTranslate: false,
                isFetching: false, createdAt: '', updatedAt: '', faviconUrl: null, description: null,
                lastFetchAt: null, lastFetchStatus: null, nextFetchAt: null
            },
            {
                id: '3', title: 'F3', url: '', categoryId: null,
                unreadCount: 10, totalArticles: 20, isActive: true, autoTranslate: false,
                isFetching: false, createdAt: '', updatedAt: '', faviconUrl: null, description: null,
                lastFetchAt: null, lastFetchStatus: null, nextFetchAt: null
            }
        ];

        it('should group feeds by category id', () => {
            const { groups, categories } = calculateFeedGroups(feeds);

            expect(groups).toHaveLength(2); // One category + one uncategorized
            expect(categories).toHaveLength(1);

            const cat1Group = groups.find(g => g.category?.id === 'c1');
            expect(cat1Group?.feeds).toHaveLength(2);
            expect(cat1Group?.totalUnreadCount).toBe(5);
        });

        it('should handle uncategorized feeds', () => {
            const { groups } = calculateFeedGroups(feeds);
            const uncategorized = groups.find(g => g.category === null);

            expect(uncategorized).toBeDefined();
            expect(uncategorized?.feeds).toHaveLength(1);
            expect(uncategorized?.totalUnreadCount).toBe(10);
        });

        it('should return empty arrays for empty input', () => {
            const { groups, categories } = calculateFeedGroups([]);
            expect(groups).toHaveLength(0);
            expect(categories).toHaveLength(0);
        });
    });
});
