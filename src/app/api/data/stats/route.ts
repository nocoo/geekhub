import { NextRequest, NextResponse } from 'next/server';
import { createSmartSupabaseClient } from '@/lib/supabase-server';

// GET /api/data/stats - Get system statistics
export async function GET(request: NextRequest) {
  try {
    const { client: supabase, user } = await createSmartSupabaseClient();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all feeds
    const { data: feeds, error: feedsError } = await supabase
      .from('feeds')
      .select('id, is_active')
      .eq('user_id', user.id);

    if (feedsError) {
      throw feedsError;
    }

    // Get feed IDs for batch query
    const feedIds = feeds.map(f => f.id);

    // Get fetch status for all feeds
    let totalArticles = 0;
    let totalUnread = 0;
    let todayFetched = 0;
    let errorFeeds = 0;

    if (feedIds.length > 0) {
      const { data: fetchStatuses } = await supabase
        .from('fetch_status')
        .select('feed_id, total_articles, unread_count, last_fetch_at, last_fetch_status')
        .in('feed_id', feedIds);

      if (fetchStatuses) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const status of fetchStatuses) {
          totalArticles += status.total_articles || 0;
          totalUnread += status.unread_count || 0;

          // Count today's fetches
          if (status.last_fetch_at) {
            const lastFetch = new Date(status.last_fetch_at);
            if (lastFetch >= today) {
              todayFetched++;
            }
          }

          // Count error feeds (fetched but failed)
          if (status.last_fetch_status === 'error') {
            errorFeeds++;
          }
        }
      }
    }

    // Calculate feed statistics
    const totalFeeds = feeds.length;
    const activeFeeds = feeds.filter(f => f.is_active).length;
    const pausedFeeds = totalFeeds - activeFeeds;

    // Get total read count from user_articles
    const { count: totalRead } = await supabase
      .from('user_articles')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', true);

    const stats = {
      totalFeeds,
      activeFeeds,
      pausedFeeds,
      errorFeeds,
      totalArticles,
      totalRead: totalRead || 0,
      totalUnread,
      todayFetched,
      storageSize: totalArticles, // Approximate size (article count)
      lastUpdate: new Date().toISOString(),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Data stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
