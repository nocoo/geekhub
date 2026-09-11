import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Service for user article interactions (read, bookmarked, read later)
 * Uses the unified user_articles table
 */
export class ReadStatusService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Create Supabase client
   */
  private async createClient() {
    const cookieStore = await cookies();
    return createServerClient(
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
  }

  /**
   * Get read article IDs for a feed
   * Returns a Set of article IDs that are marked as read
   */
  async getReadArticleIds(feedId: string): Promise<Set<string>> {
    const supabase = await this.createClient();
    const { data, error } = await supabase
      .from('user_articles')
      .select('article_id')
      .eq('is_read', true)
      .eq('user_id', this.userId);

    if (error || !data) {
      console.error('Error fetching read status:', error);
      return new Set();
    }

    // Filter by feed_id via articles table
    const articleIds = data.map(ua => ua.article_id);
    if (articleIds.length === 0) {
      return new Set();
    }

    const { data: articles } = await supabase
      .from('articles')
      .select('id')
      .in('id', articleIds)
      .eq('feed_id', feedId);

    return new Set(articles?.map(a => a.id) || []);
  }

  /**
   * Get read article hashes for a feed (for backward compatibility)
   * Returns a Set of article hashes that are marked as read
   */
  async getReadHashes(feedId: string): Promise<Set<string>> {
    const supabase = await this.createClient();
    const { data, error } = await supabase
      .from('user_articles')
      .select('article_id')
      .eq('is_read', true)
      .eq('user_id', this.userId);

    if (error || !data) {
      console.error('Error fetching read status:', error);
      return new Set();
    }

    const articleIds = data.map(ua => ua.article_id);
    if (articleIds.length === 0) {
      return new Set();
    }

    // Get hashes from articles table
    const { data: articles } = await supabase
      .from('articles')
      .select('hash')
      .in('id', articleIds)
      .eq('feed_id', feedId);

    return new Set(articles?.map(a => a.hash) || []);
  }

  /**
   * Mark an article as read
   */
  async markAsRead(articleId: string): Promise<boolean> {
    const supabase = await this.createClient();
    const { error } = await supabase
      .from('user_articles')
      .upsert({
        user_id: this.userId,
        article_id: articleId,
        is_read: true,
        read_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,article_id'
      });

    return !error;
  }

  /**
   * Mark an article as read by hash (for backward compatibility)
   */
  async markAsReadByHash(feedId: string, articleHash: string): Promise<boolean> {
    const supabase = await this.createClient();

    // First get the article ID from hash
    const { data: article } = await supabase
      .from('articles')
      .select('id')
      .eq('feed_id', feedId)
      .eq('hash', articleHash)
      .maybeSingle();

    if (!article) {
      console.warn('Article not found for hash:', articleHash);
      return false;
    }

    return this.markAsRead(article.id);
  }

  /**
   * Mark all articles in a feed as read
   */
  async markAllAsRead(feedId: string, articleIds: string[]): Promise<number> {
    const supabase = await this.createClient();
    const now = new Date().toISOString();

    // Build records to upsert
    const records = articleIds.map(articleId => ({
      user_id: this.userId,
      article_id: articleId,
      is_read: true,
      read_at: now,
    }));

    const { error } = await supabase
      .from('user_articles')
      .upsert(records, {
        onConflict: 'user_id,article_id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('Error marking all as read:', error);
      return 0;
    }

    return articleIds.length;
  }

  /**
   * Mark an article as unread
   */
  async markAsUnread(articleId: string): Promise<boolean> {
    const supabase = await this.createClient();
    const { error } = await supabase
      .from('user_articles')
      .update({
        is_read: false,
        read_at: null,
      })
      .eq('article_id', articleId)
      .eq('user_id', this.userId);

    return !error;
  }

  /**
   * Mark an article as unread by hash (for backward compatibility)
   */
  async markAsUnreadByHash(feedId: string, articleHash: string): Promise<boolean> {
    const supabase = await this.createClient();

    // First get the article ID from hash
    const { data: article } = await supabase
      .from('articles')
      .select('id')
      .eq('feed_id', feedId)
      .eq('hash', articleHash)
      .maybeSingle();

    if (!article) {
      console.warn('Article not found for hash:', articleHash);
      return false;
    }

    return this.markAsUnread(article.id);
  }

  /**
   * Toggle bookmark status
   */
  async toggleBookmark(articleId: string, notes?: string): Promise<boolean> {
    const supabase = await this.createClient();

    // Check current status
    const { data: existing } = await supabase
      .from('user_articles')
      .select('is_bookmarked')
      .eq('article_id', articleId)
      .eq('user_id', this.userId)
      .maybeSingle();

    const newStatus = !existing?.is_bookmarked;

    const { error } = await supabase
      .from('user_articles')
      .upsert({
        user_id: this.userId,
        article_id: articleId,
        is_bookmarked: newStatus,
        bookmarked_at: newStatus ? new Date().toISOString() : null,
        notes: newStatus ? notes : null,
      }, {
        onConflict: 'user_id,article_id'
      });

    return !error;
  }

  /**
   * Toggle read later status
   */
  async toggleReadLater(articleId: string): Promise<boolean> {
    const supabase = await this.createClient();

    // Check current status
    const { data: existing } = await supabase
      .from('user_articles')
      .select('is_read_later')
      .eq('article_id', articleId)
      .eq('user_id', this.userId)
      .maybeSingle();

    const newStatus = !existing?.is_read_later;

    const { error } = await supabase
      .from('user_articles')
      .upsert({
        user_id: this.userId,
        article_id: articleId,
        is_read_later: newStatus,
        read_later_at: newStatus ? new Date().toISOString() : null,
      }, {
        onConflict: 'user_id,article_id'
      });

    return !error;
  }
}

/**
 * Helper function to create ReadStatusService from request
 */
export async function createReadStatusService(): Promise<ReadStatusService | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Ignore
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return new ReadStatusService(user.id);
}
