/**
 * Article View Model Types
 */

export interface ArticleViewModel {
    id: string;              // article id
    feedId: string;          // feed ID from database
    title: string;
    url: string;
    description: string;
    author?: string;
    publishedAt: Date | null;
    feedName: string;
    feedIcon: string;
    isRead: boolean;
    hash?: string;
    urlHash?: string;
    image: string | null;
    content?: string;        // full HTML content
    translatedTitle?: string;
    translatedDescription?: string;
    ai_summary?: {
        content: string;
        model: string;
        generated_at: string;
        usage?: {
            prompt_tokens: number;
            completion_tokens: number;
            total_tokens: number;
        };
    };
}

/**
 * Feed metadata for UI
 */
export interface FeedViewModel {
    id: string;
    title: string;
    url: string;
}

/**
 * Result type for article list
 */
export interface ArticlesResult {
    feed: FeedViewModel;
    articles: ArticleViewModel[];
    total: number;
    lastUpdated: string | null;
}
