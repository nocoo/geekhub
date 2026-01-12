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

    if (!feeds || feeds.length === 0) {
      return NextResponse.json({ feeds: [] });
    }

    const feedIds = (feeds || []).map(f => f.id);

    // Get total articles count per feed
    const { data: articlesData } = await supabase
      .from('articles')
      .select('feed_id, id')
      .in('feed_id', feedIds);

    // Get read article counts per feed (user_articles where is_read = true)
    const articleIds = (articlesData || []).map(a => a.id);
    const { data: readData } = articleIds.length > 0
      ? await supabase
          .from('user_articles')
          .select('article_id, is_read')
          .in('article_id', articleIds)
          .eq('is_read', true)
      : { data: [] };

    // Get fetch_status for all feeds
    const { data: cacheData } = await supabase
      .from('fetch_status')
      .select('*')
      .in('feed_id', feedIds);

    // Build articles count map
    const articlesCountMap = new Map<string, number>();
    for (const a of articlesData || []) {
      articlesCountMap.set(a.feed_id, (articlesCountMap.get(a.feed_id) || 0) + 1);
    }

    // Build read count map
    const readCountMap = new Map<string, number>();
    for (const r of readData || []) {
      const article = articlesData?.find(a => a.id === r.article_id);
      if (article) {
        readCountMap.set(article.feed_id, (readCountMap.get(article.feed_id) || 0) + 1);
      }
    }

    // Build cache map
    const cacheMap = new Map(cacheData?.map(c => [c.feed_id, c]) || []);

    // Combine data
    const feedsWithCounts = (feeds || []).map((feed: any) => {
      const cache = cacheMap.get(feed.id);
      const totalArticles = articlesCountMap.get(feed.id) || 0;
      const readCount = readCountMap.get(feed.id) || 0;
      return {
        ...feed,
        total_articles: totalArticles,
        unread_count: totalArticles - readCount,
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
