import { ArticleRepository } from './article-repository';
import { ReadStatusService } from './read-status-service';

/**
 * Complete article for UI display
 */
export interface ArticleViewModel {
  id: string;              // article hash
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
  urlHash: string;         // feed URL hash for file system path
  image: string | null;
  content?: string;        // full HTML content - now included in list
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

/**
 * ViewModel combining file system data and database status
 */
export class ArticleViewModelService {
  private repo: ArticleRepository;

  constructor(dataDir?: string) {
    this.repo = new ArticleRepository(dataDir);
  }

  /**
   * Get articles for a specific feed with read status
   */
  async getArticlesForFeed(
    feedId: string,
    feedUrlHash: string,
    feedTitle: string,
    feedIcon: string,
    readStatusService: ReadStatusService
  ): Promise<ArticlesResult> {
    // 1. Get index from file system
    const index = await this.repo.getIndex(feedUrlHash);

    if (!index) {
      return {
        feed: {
          id: feedId,
          title: feedTitle,
          url: '',
        },
        articles: [],
        total: 0,
        lastUpdated: null,
      };
    }

    // 2. Get read hashes from database
    const readHashes = await readStatusService.getReadHashes(feedId);

    // 3. Load article content and extract images
    const articlesWithContent = await Promise.all(
      index.articles.map(async (article) => {
        let firstImage: string | null = null;
        let content: string | undefined = undefined;
        let ai_summary: any = undefined;
        try {
          const fullArticle = await this.repo.getArticle(feedUrlHash, article.hash);
          if (fullArticle?.content) {
            firstImage = this.extractFirstImage(fullArticle.content);
            content = fullArticle.content;  // 保存完整内容
          }
          if (fullArticle?.ai_summary) {
            ai_summary = fullArticle.ai_summary;
          }
        } catch {
          // Ignore errors, image and content will be null/undefined
        }

        return {
          ...article,
          firstImage,
          content,
          ai_summary,
        };
      })
    );

    // 4. Combine into view model
    const articles: ArticleViewModel[] = articlesWithContent.map((article) => ({
      id: article.hash,
      feedId: feedId,
      title: article.title,
      url: article.url,
      description: article.summary || '',
      author: article.author || '',
      publishedAt: article.published_at ? new Date(article.published_at) : null,
      feedName: feedTitle,
      feedIcon: feedIcon || '',
      isRead: readHashes.has(article.hash),
      hash: article.hash,
      urlHash: feedUrlHash,
      image: article.firstImage,
      content: article.content,  // 包含完整内容
      ai_summary: article.ai_summary,
    }));

    return {
      feed: {
        id: feedId,
        title: feedTitle,
        url: '', // Not available in index
      },
      articles,
      total: index.total_count,
      lastUpdated: index.last_updated,
    };
  }

  /**
   * Extract first image from HTML content
   * Handles various src attribute formats: src="...", src='...', src=..., data-src=...
   */
  private extractFirstImage(html: string): string | null {
    if (!html) {
      return null;
    }

    // Try multiple patterns to find the first valid image URL
    const patterns = [
      // Standard src with quotes
      /<img[^>]+src=["']([^"']+)["'][^>]*>/i,
      // src without quotes (fallback)
      /<img[^>]+src=([^"\s>]+)[^>]*>/i,
      // data-src attribute (lazy loaded images)
      /<img[^>]+data-src=["']([^"']+)["'][^>]*>/i,
      // Check for picture source
      /<source[^>]+srcset=["']([^"']+)["'][^>]*>/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        let url = match[1];
        // Decode HTML entities like &amp; -> &
        url = url.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
        // Filter out empty strings, data URLs, and invalid URLs
        if (url && !url.startsWith('data:') && (url.startsWith('http') || url.startsWith('//'))) {
          return url.startsWith('//') ? 'https:' + url : url;
        }
      }
    }

    return null;
  }

  /**
   * Get a single article with read status
   */
  async getArticle(
    feedUrlHash: string,
    articleHash: string,
    feedId: string,
    feedTitle: string,
    feedIcon: string,
    readStatusService: ReadStatusService
  ): Promise<ArticleViewModel | null> {
    const article = await this.repo.getArticle(feedUrlHash, articleHash);

    if (!article) {
      return null;
    }

    const readHashes = await readStatusService.getReadHashes(feedId);
    const firstImage = article.content ? this.extractFirstImage(article.content) : null;

    return {
      id: article.hash,
      feedId: feedId,
      title: article.title,
      url: article.url,
      description: article.summary || article.content_text || '',
      author: article.author || '',
      publishedAt: article.published_at ? new Date(article.published_at) : null,
      feedName: feedTitle,
      feedIcon: feedIcon || '',
      isRead: readHashes.has(article.hash),
      hash: article.hash,
      urlHash: feedUrlHash,
      image: firstImage,
      ai_summary: article.ai_summary,
    };
  }
}
