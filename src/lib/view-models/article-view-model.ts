/**
 * Article View Model Utilities
 * 
 * Pure logic for transforming API responses to ViewModels.
 */

import { Article } from "@/hooks/useDatabase";

/**
 * Raw Article Data from Database (Snake Case)
 */
export interface ArticleRawData {
    id: string;
    feed_id: string;
    title: string;
    url: string;
    link?: string;
    author?: string;
    published_at: string;
    content?: string;
    content_text?: string;
    summary?: string;
    hash: string;
    fetched_at: string;
    created_at: string;
}

/**
 * Transforms raw article data into a standardized Article ViewModel
 * 
 * @param article - Raw article data from DB
 * @param feedInfo - Optional feed metadata (name, icon)
 * @param isRead - Read status for the current user
 * @returns Standardized Article ViewModel
 */
export function transformArticleToViewModel(
    article: any, // Using any for flexibility during transition
    feedInfo: { name: string; icon: string },
    isRead: boolean = false
): Article {
    const content = article.content || '';

    return {
        id: article.id,
        feedId: article.feed_id || article.feedId,
        title: article.title,
        url: article.url,
        description: article.summary || article.content_text || '',
        author: article.author || '',
        publishedAt: article.published_at ? new Date(article.published_at) : null,
        feedName: feedInfo.name,
        feedIcon: feedInfo.icon,
        isRead: isRead,
        hash: article.hash,
        image: extractFirstImage(content),
        content: content,
    };
}

/**
 * Extract first image from HTML content
 * 
 * @param html - HTML content string
 * @returns First image URL or null
 */
export function extractFirstImage(html: string): string | null {
    if (!html) return null;

    const patterns = [
        /<img[^>]+src=["']([^"']+)["'][^>]*>/i,
        /<img[^>]+src=([^"\s>]+)[^>]*>/i,
        /<img[^>]+data-src=["']([^"']+)["'][^>]*>/i,
        /<source[^>]+srcset=["']([^"']+)["'][^>]*>/i,
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            let url = match[1];
            url = url.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
            if (url && !url.startsWith('data:') && (url.startsWith('http') || url.startsWith('//'))) {
                return url.startsWith('//') ? 'https:' + url : url;
            }
        }
    }

    return null;
}
