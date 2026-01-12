import { createClient } from '@supabase/supabase-js';

/**
 * Complete article for UI display
 */
export interface ArticleViewModel {
  id: string;              // article id
  feedId: string;          // feed ID from database
  title: string;
  url: string;
  description: string;
  author: string;
  publishedAt: Date | null;
  feedName: string;
  feedIcon: string;
  isRead: boolean;
  hash: string;
  image: string | null;
  content?: string;        // full HTML content
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

/**
 * ViewModel combining database data
 * Note: Supabase client should be passed from the caller (API route)
 * to properly handle async cookies in Next.js
 */
export class ArticleViewModelService {
  private supabase: any;

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

  /**
   * Get articles for a specific feed with read status
   */
  async getArticlesForFeed(
    feedId: string,
    feedTitle: string,
    feedIcon: string,
    readArticleIds: Set<string>
  ): Promise<ArticlesResult> {
    // Get articles from database
    const { data: articles, error } = await this.supabase
      .from('articles')
      .select('*')
      .eq('feed_id', feedId)
      .order('published_at', { ascending: false })
      .limit(100);

    if (error || !articles || articles.length === 0) {
      return {
        feed: { id: feedId, title: feedTitle, url: '' },
        articles: [],
        total: 0,
        lastUpdated: null,
      };
    }

    // Process articles
    const processedArticles = articles.map((article: any) => {
      const firstImage = this.extractFirstImage(article.content || '');
      return {
        id: article.id,
        feedId: feedId,
        title: article.title,
        url: article.url,
        description: article.summary || '',
        author: article.author || '',
        publishedAt: article.published_at ? new Date(article.published_at) : null,
        feedName: feedTitle,
        feedIcon: feedIcon || '',
        isRead: readArticleIds.has(article.id),
        hash: article.hash,
        image: firstImage,
        content: article.content,
      };
    });

    return {
      feed: { id: feedId, title: feedTitle, url: '' },
      articles: processedArticles,
      total: articles.length,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get a single article with read status
   */
  async getArticle(
    feedId: string,
    articleId: string,
    feedTitle: string,
    feedIcon: string,
    readArticleIds: Set<string>
  ): Promise<ArticleViewModel | null> {
    const { data: article, error } = await this.supabase
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .eq('feed_id', feedId)
      .single();

    if (error || !article) {
      return null;
    }

    const firstImage = this.extractFirstImage(article.content || '');

    return {
      id: article.id,
      feedId: feedId,
      title: article.title,
      url: article.url,
      description: article.summary || article.content_text || '',
      author: article.author || '',
      publishedAt: article.published_at ? new Date(article.published_at) : null,
      feedName: feedTitle,
      feedIcon: feedIcon || '',
      isRead: readArticleIds.has(article.id),
      hash: article.hash,
      image: firstImage,
      content: article.content,
    };
  }

  /**
   * Extract first image from HTML content
   */
  private extractFirstImage(html: string): string | null {
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
}
