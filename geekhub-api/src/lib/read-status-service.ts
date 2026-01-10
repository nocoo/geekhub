import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Service for read status operations (database)
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
   * Get read article hashes for a feed
   * Returns a Set of article hashes that are marked as read
   */
  async getReadHashes(feedId: string): Promise<Set<string>> {
    const supabase = await this.createClient();
    const { data, error } = await supabase
      .from('read_articles')
      .select('article_hash')
      .eq('feed_id', feedId)
      .eq('user_id', this.userId);

    if (error || !data) {
      console.error('Error fetching read status:', error);
      return new Set();
    }

    return new Set(data.map((ra: { article_hash: string }) => ra.article_hash));
  }

  /**
   * Mark an article as read
   */
  async markAsRead(feedId: string, articleHash: string): Promise<boolean> {
    const supabase = await this.createClient();
    const { error } = await supabase
      .from('read_articles')
      .insert({
        feed_id: feedId,
        article_hash: articleHash,
        user_id: this.userId,
      });

    return !error;
  }

  /**
   * Mark all articles in a feed as read
   */
  async markAllAsRead(feedId: string, articleHashes: string[]): Promise<number> {
    const supabase = await this.createClient();
    const records = articleHashes.map(hash => ({
      feed_id: feedId,
      article_hash: hash,
      user_id: this.userId,
    }));

    const { error } = await supabase
      .from('read_articles')
      .insert(records);

    if (error) {
      console.error('Error marking all as read:', error);
      return 0;
    }

    return articleHashes.length;
  }

  /**
   * Mark an article as unread
   */
  async markAsUnread(feedId: string, articleHash: string): Promise<boolean> {
    const supabase = await this.createClient();
    const { error } = await supabase
      .from('read_articles')
      .delete()
      .eq('feed_id', feedId)
      .eq('article_hash', articleHash)
      .eq('user_id', this.userId);

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
