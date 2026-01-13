import { NextResponse } from 'next/server';
import { createSmartSupabaseClient } from '@/lib/supabase-server';

// GET /api/feeds/list - Get feed list with cached counts
export async function GET() {
  try {
    const { client: supabase, user } = await createSmartSupabaseClient();
    if (!user) {
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

    const feedIds = feeds.map(f => f.id);

    // Get fetch_status for all feeds (contains cached counts)
    const { data: cacheData } = await supabase
      .from('fetch_status')
      .select('*')
      .in('feed_id', feedIds);

    // Build cache map
    const cacheMap = new Map((cacheData || []).map(c => [c.feed_id, c]));

    // Combine data
    const feedsWithCounts = feeds.map((feed: any) => {
      const cache = cacheMap.get(feed.id);
      return {
        ...feed,
        total_articles: cache?.total_articles || 0,
        unread_count: cache?.unread_count || 0,
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
