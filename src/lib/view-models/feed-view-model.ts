/**
 * Feed View Model Utilities
 * 
 * Pure logic for transforming API responses to ViewModels and grouping data.
 * These functions are decoupled from React and can be tested independently.
 */

import { FeedViewModel, CategoryViewModel, FeedGroupViewModel } from "@/types/feed-view-model";

/**
 * Raw API response type for a Field
 */
export interface FeedApiResponse {
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

/**
 * Transforms a raw API feed object into a standard FeedViewModel
 * 
 * @param feed - Raw API response data
 * @returns Transformed FeedViewModel
 */
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
        isFetching: false, // Default state, to be overridden by Context if needed
        lastFetchAt: feed.last_fetch_at,
        lastFetchStatus: feed.last_fetch_status,
        nextFetchAt: feed.next_fetch_at,
        createdAt: feed.created_at,
        updatedAt: feed.updated_at,
    };
}

/**
 * Groups a collection of FeedViewModels by their categories
 * 
 * @param feeds - Array of FeedViewModels to group
 * @returns Grouped feeds with category metadata
 */
export function calculateFeedGroups(feeds: FeedViewModel[]): {
    groups: FeedGroupViewModel[];
    categories: CategoryViewModel[];
} {
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

    return { groups, categories };
}
