import { extractFirstImage, transformArticleToViewModel } from './view-models/article-view-model';
import { ArticleViewModel, ArticlesResult } from '@/types/article-view-model';

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
    const processedArticles = articles.map((article: any) =>
      transformArticleToViewModel(
        article,
        { name: feedTitle, icon: feedIcon || '' },
        readArticleIds.has(article.id)
      )
    );

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

    return transformArticleToViewModel(
      article,
      { name: feedTitle, icon: feedIcon || '' },
      readArticleIds.has(article.id)
    );
  }
}
