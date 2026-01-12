import { NextRequest, NextResponse } from 'next/server';
import { createSmartSupabaseClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

// GET /api/data/storage - Get estimated Supabase storage size
export async function GET(request: NextRequest) {
  try {
    const { client: supabase, user } = await createSmartSupabaseClient();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Get user's feeds
    const { data: userFeeds } = await supabase
      .from('feeds')
      .select('id');

    if (!userFeeds || userFeeds.length === 0) {
      return NextResponse.json({
        totalSize: 0,
        breakdown: {
          feeds: 0,
          categories: 0,
          articles: 0,
          userArticles: 0,
          logs: 0,
          other: 0,
        },
        stats: {
          totalFeeds: 0,
          totalArticles: 0,
          totalLogs: 0,
        },
        supabaseLimits: {
          freeDatabaseLimit: 500 * 1024 * 1024, // 500MB
          freeFileStorageLimit: 1024 * 1024 * 1024, // 1GB
        },
      });
    }

    // Get row counts and estimate sizes
    const userFeedIds = userFeeds.map(f => f.id);

    // Count articles and estimate size
    const { count: articleCount } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .in('feed_id', userFeedIds);

    // Count user_articles
    const { count: userArticleCount } = await supabase
      .from('user_articles')
      .select('*', { count: 'exact', head: true });

    // Count fetch_logs
    const { count: logsCount } = await supabase
      .from('fetch_logs')
      .select('*', { count: 'exact', head: true });

    // Estimate sizes based on row counts and average row sizes
    // These are rough estimates based on typical data sizes
    const feedsSize = userFeeds.length * 1024; // ~1KB per feed
    const categoriesSize = userFeeds.length * 512; // ~512B per category
    const articleSize = (articleCount || 0) * 5 * 1024; // ~5KB per article (with content)
    const userArticleSize = (userArticleCount || 0) * 200; // ~200B per user_article record
    const logsSize = (logsCount || 0) * 500; // ~500B per log entry
    const fetchStatusSize = userFeeds.length * 256; // ~256B per fetch_status

    const totalSize = feedsSize + categoriesSize + articleSize + userArticleSize + logsSize + fetchStatusSize;

    return NextResponse.json({
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      breakdown: {
        feeds: feedsSize,
        categories: categoriesSize,
        articles: articleSize,
        userArticles: userArticleSize,
        logs: logsSize,
        fetchStatus: fetchStatusSize,
        other: 0,
      },
      breakdownFormatted: {
        feeds: formatBytes(feedsSize),
        categories: formatBytes(categoriesSize),
        articles: formatBytes(articleSize),
        userArticles: formatBytes(userArticleSize),
        logs: formatBytes(logsSize),
        fetchStatus: formatBytes(fetchStatusSize),
      },
      stats: {
        totalFeeds: userFeeds.length,
        totalArticles: articleCount || 0,
        totalUserArticles: userArticleCount || 0,
        totalLogs: logsCount || 0,
      },
      supabaseLimits: {
        freeDatabaseLimit: 500 * 1024 * 1024, // 500MB
        freeFileStorageLimit: 1024 * 1024 * 1024, // 1GB
        freeDatabaseLimitFormatted: '500 MB',
        freeFileStorageLimitFormatted: '1 GB',
      },
      usage: {
        databasePercent: ((totalSize / (500 * 1024 * 1024)) * 100).toFixed(2),
        databaseUsed: totalSize,
        databaseUsedFormatted: formatBytes(totalSize),
        databaseLimit: 500 * 1024 * 1024,
        databaseLimitFormatted: '500 MB',
      },
    });
  } catch (error) {
    console.error('Storage size error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

