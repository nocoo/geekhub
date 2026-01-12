import { NextRequest, NextResponse } from 'next/server';
import { createSmartSupabaseClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

// Service client for bypassing RLS during cleanup
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

interface CleanupRequest {
  feedId?: string;
  olderThanDays?: number;
  deleteRead?: boolean;
}

// POST /api/data/cleanup-articles - Cleanup articles based on criteria
export async function POST(request: NextRequest) {
  try {
    const { client: supabase, user } = await createSmartSupabaseClient();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CleanupRequest = await request.json();
    const { feedId, olderThanDays, deleteRead } = body;

    // Validate request
    if (!feedId && !olderThanDays && !deleteRead) {
      return NextResponse.json(
        { error: 'Must specify at least one cleanup criteria' },
        { status: 400 }
      );
    }

    const serviceClient = getServiceClient();
    let deletedCount = 0;
    const errors: string[] = [];

    // Get user's feeds
    const { data: userFeeds } = await supabase
      .from('feeds')
      .select('id')
      .eq('user_id', user.id);

    if (!userFeeds || userFeeds.length === 0) {
      return NextResponse.json({ deletedCount, errors: ['No feeds found'] });
    }

    const userFeedIds = userFeeds.map(f => f.id);
    const targetFeedIds = feedId ? [feedId] : userFeedIds;

    // Validate feed ownership
    if (feedId && !targetFeedIds.includes(feedId)) {
      return NextResponse.json(
        { error: 'Feed not found or access denied' },
        { status: 404 }
      );
    }

    // Build cleanup query
    let deleteQuery = serviceClient
      .from('articles')
      .delete()
      .in('feed_id', targetFeedIds);

    // Apply filters
    if (olderThanDays) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      deleteQuery = deleteQuery.lt('published_at', cutoffDate.toISOString());
    }

    if (deleteRead) {
      // Get read article IDs
      const { data: readArticles } = await supabase
        .from('user_articles')
        .select('article_id')
        .eq('is_read', true);

      if (readArticles && readArticles.length > 0) {
        const readArticleIds = readArticles.map(ra => ra.article_id);
        deleteQuery = deleteQuery.in('id', readArticleIds);
      } else {
        // No read articles to delete
        return NextResponse.json({ deletedCount: 0, errors: [] });
      }
    }

    // Execute delete
    const { error: deleteError, count } = await deleteQuery;

    if (deleteError) {
      errors.push(deleteError.message);
    } else {
      deletedCount = count || 0;
    }

    // Also cleanup orphaned user_articles and fetch_status
    if (deletedCount > 0) {
      // Cleanup user_articles
      await serviceClient
        .from('user_articles')
        .delete()
        .not('article_id', 'in',
          serviceClient
            .from('articles')
            .select('id')
        );

      // Update fetch_status counts for affected feeds
      for (const feedId of targetFeedIds) {
        // Recalculate counts
        const { data: articles } = await serviceClient
          .from('articles')
          .select('id')
          .eq('feed_id', feedId);

        const { data: readArticles } = await serviceClient
          .from('user_articles')
          .select('article_id')
          .eq('is_read', true);

        const totalArticles = articles?.length || 0;
        const unreadCount = totalArticles - (readArticles?.length || 0);

        await serviceClient
          .from('fetch_status')
          .update({
            total_articles: totalArticles,
            unread_count: unreadCount,
            last_fetch_at: new Date().toISOString(),
          })
          .eq('feed_id', feedId);
      }
    }

    return NextResponse.json({
      deletedCount,
      errors,
      message: `Successfully deleted ${deletedCount} article(s)`
    });
  } catch (error) {
    console.error('Cleanup articles error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET /api/data/cleanup-articles - Get cleanup statistics
export async function GET(request: NextRequest) {
  try {
    const { client: supabase, user } = await createSmartSupabaseClient();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get article statistics
    const { data: userFeeds } = await supabase
      .from('feeds')
      .select('id')
      .eq('user_id', user.id);

    if (!userFeeds || userFeeds.length === 0) {
      return NextResponse.json({
        totalArticles: 0,
        readArticles: 0,
        unreadArticles: 0,
        articlesByFeed: [],
      });
    }

    const userFeedIds = userFeeds.map(f => f.id);

    // Get total articles
    const { data: articles } = await supabase
      .from('articles')
      .select('id, feed_id, published_at')
      .in('feed_id', userFeedIds);

    // Get read article IDs
    const { data: readArticleRecords } = await supabase
      .from('user_articles')
      .select('article_id')
      .eq('is_read', true);

    const readArticleIds = new Set(readArticleRecords?.map(ra => ra.article_id) || []);
    const readArticles = articles?.filter(a => readArticleIds.has(a.id)) || [];
    const unreadArticles = articles?.filter(a => !readArticleIds.has(a.id)) || [];

    // Group by feed
    const articlesByFeed = userFeeds.map(feed => ({
      feedId: feed.id,
      total: articles?.filter(a => a.feed_id === feed.id).length || 0,
      read: readArticles.filter(a => a.feed_id === feed.id).length,
      unread: unreadArticles.filter(a => a.feed_id === feed.id).length,
    }));

    // Calculate old articles (older than 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const oldArticles = articles?.filter(a => new Date(a.published_at) < thirtyDaysAgo) || [];

    return NextResponse.json({
      totalArticles: articles?.length || 0,
      readArticles: readArticles.length,
      unreadArticles: unreadArticles.length,
      oldArticles: oldArticles.length,
      articlesByFeed,
    });
  } catch (error) {
    console.error('Get cleanup stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
