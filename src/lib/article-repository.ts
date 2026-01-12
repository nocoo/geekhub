import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * Raw article data from database
 */
export interface ArticleRaw {
  id: string;
  hash: string;
  title: string;
  url: string;
  link?: string;
  author?: string;
  published_at?: string;
  content?: string;
  content_text?: string;
  summary?: string;
  categories?: string[];
  tags?: string[];
  fetched_at: string;
}

/**
 * Article index (replaces index.json)
 */
export interface ArticleIndex {
  last_updated: string;
  total_count: number;
  articles: Array<{
    id: string;
    hash: string;
    title: string;
    url: string;
    link?: string;
    author?: string;
    published_at?: string;
    summary?: string;
  }>;
}

/**
 * Repository for article database operations
 */
export class ArticleRepository {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabaseClient?: ReturnType<typeof createClient>) {
    this.supabase = supabaseClient || createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY! // Use service key for admin access
    );
  }

  /**
   * Create a Supabase client for server-side use
   */
  static async forServer(): Promise<ArticleRepository> {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore if called from Server Component
            }
          },
        },
      }
    );
    return new ArticleRepository(supabase as any);
  }

  /**
   * Get article index for a feed (replaces index.json)
   */
  async getIndex(feedId: string): Promise<ArticleIndex | null> {
    const { data, error } = await this.supabase
      .from('articles')
      .select('id, hash, title, url, link, author, published_at, summary, fetched_at')
      .eq('feed_id', feedId)
      .order('published_at', { ascending: false })
      .limit(1000);

    if (error || !data) {
      return null;
    }

    return {
      last_updated: new Date().toISOString(),
      total_count: data.length,
      articles: data.map(a => ({
        id: a.id,
        hash: a.hash,
        title: a.title,
        url: a.url,
        link: a.link,
        author: a.author,
        published_at: a.published_at,
        summary: a.summary,
      }))
    };
  }

  /**
   * Get all article hashes from a feed
   */
  async getArticleHashes(feedId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('articles')
      .select('hash')
      .eq('feed_id', feedId)
      .order('published_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map(a => a.hash);
  }

  /**
   * Get a single article by ID
   */
  async getArticle(articleId: string): Promise<ArticleRaw | null> {
    const { data, error } = await this.supabase
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as ArticleRaw;
  }

  /**
   * Get a single article by hash for a feed
   */
  async getArticleByHash(feedId: string, hash: string): Promise<ArticleRaw | null> {
    const { data, error } = await this.supabase
      .from('articles')
      .select('*')
      .eq('feed_id', feedId)
      .eq('hash', hash)
      .single();

    if (error || !data) {
      return null;
    }

    return data as ArticleRaw;
  }

  /**
   * Get multiple articles by their IDs
   */
  async getArticlesByIds(articleIds: string[]): Promise<ArticleRaw[]> {
    if (articleIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('articles')
      .select('*')
      .in('id', articleIds);

    if (error || !data) {
      return [];
    }

    return data as ArticleRaw[];
  }

  /**
   * Get multiple articles by their hashes for a feed
   */
  async getArticles(feedId: string, hashes: string[]): Promise<ArticleRaw[]> {
    if (hashes.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('articles')
      .select('*')
      .eq('feed_id', feedId)
      .in('hash', hashes);

    if (error || !data) {
      return [];
    }

    return data as ArticleRaw[];
  }

  /**
   * Get all articles for a feed (with optional limit)
   */
  async getAllArticles(feedId: string, limit?: number): Promise<ArticleRaw[]> {
    let query = this.supabase
      .from('articles')
      .select('*')
      .eq('feed_id', feedId)
      .order('published_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return data as ArticleRaw[];
  }

  /**
   * Check if a feed has any articles
   */
  async feedHasArticles(feedId: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('feed_id', feedId)
      .limit(1);

    return !error && (count || 0) > 0;
  }
}
