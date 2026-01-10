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
  image: string | null;
  content?: string;        // full HTML content - now included in list
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
        try {
          const fullArticle = await this.repo.getArticle(feedUrlHash, article.hash);
          if (fullArticle?.content) {
            firstImage = this.extractFirstImage(fullArticle.content);
            content = fullArticle.content;  // 保存完整内容
          }
        } catch {
          // Ignore errors, image and content will be null/undefined
        }

        return {
          ...article,
          firstImage,
          content,
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
      image: article.firstImage,
      content: article.content,  // 包含完整内容
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
   */
  private extractFirstImage(html: string): string | null {
    if (!html) return null;
    const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    return imgMatch ? imgMatch[1] : null;
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
      image: firstImage,
    };
  }
}
