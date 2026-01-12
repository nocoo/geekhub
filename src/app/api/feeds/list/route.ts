import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function createSupabaseClient() {
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

// GET /api/feeds/list - 获取带未读数的 feeds 列表
export async function GET() {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all feeds with categories
    const { data: feeds, error: feedsError } = await supabase
      .from('feeds')
      .select(`
        *,
        category:categories(*)
      `)
      .eq('user_id', user.id)
      .order('title');

    if (feedsError) {
      return NextResponse.json({ error: feedsError.message }, { status: 500 });
    }

    // Get feed_cache and unread counts for all feeds
    const feedIds = (feeds || []).map(f => f.id);

    // Get all cache data
    const { data: cacheData } = await supabase
      .from('feed_cache')
      .select('*')
      .in('feed_id', feedIds);

    // Get unread counts from user_articles (count where is_read = false)
    // We need to calculate this by counting total articles per feed and subtracting read ones
    const { data: articlesData } = await supabase
      .from('articles')
      .select('id, feed_id')
      .in('feed_id', feedIds);

    const { data: readStatusData } = await supabase
      .from('user_articles')
      .select('article_id, is_read')
      .in('article_id', articlesData?.map(a => a.id) || []);

    // Build a map of feed_id -> unread_count
    const feedArticleIds = new Map<string, string[]>();
    for (const article of articlesData || []) {
      if (article.feed_id && article.id) {
        const ids = feedArticleIds.get(article.feed_id) || [];
        ids.push(article.id);
        feedArticleIds.set(article.feed_id, ids);
      }
    }

    const feedUnreadCount = new Map<string, number>();
    for (const feedId of feedIds) {
      const articleIds = feedArticleIds.get(feedId) || [];
      const readCount = readStatusData?.filter(
        rs => rs.article_id && articleIds.includes(rs.article_id) && rs.is_read
      ).length || 0;
      feedUnreadCount.set(feedId, Math.max(0, articleIds.length - readCount));
    }

    // Build cache map
    const cacheMap = new Map(cacheData?.map(c => [c.feed_id, c]) || []);

    // Combine data
    const feedsWithCounts = (feeds || []).map((feed: any) => {
      const cache = cacheMap.get(feed.id);
      return {
        ...feed,
        total_articles: cache?.total_articles || feedUnreadCount.get(feed.id) || 0,
        unread_count: feedUnreadCount.get(feed.id) || 0,
        last_fetch_at: cache?.last_fetch_at || null,
        last_fetch_status: cache?.last_fetch_status || null,
        next_fetch_at: cache?.next_fetch_at || null,
      };
    });

    return NextResponse.json({ feeds: feedsWithCounts });
  } catch (error) {
    console.error('Error loading feeds:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
