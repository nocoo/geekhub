import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSmartSupabaseClient } from '@/lib/supabase-server';

// Service role client for reading system tables
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

interface DatabaseTableInfo {
  table_name: string;
  row_count: number;
  size_bytes: number;
}

// GET /api/data/files - Get database storage information (replaces file system browsing)
export async function GET(request: NextRequest) {
  try {
    const { client: supabase, user } = await createSmartSupabaseClient();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

    // Get user's data counts from various tables
    const supabaseAdmin = getServiceClient();

    const [feedsResult, articlesResult, fetchLogsResult, readStatusResult, bookmarksResult] = await Promise.all([
      supabaseAdmin.from('feeds').select('id', { count: 'exact' }).eq('user_id', user.id),
      supabaseAdmin.from('articles').select('id', { count: 'exact' }),
      supabaseAdmin.from('fetch_logs').select('id', { count: 'exact' }),
      supabaseAdmin.from('read_articles').select('id', { count: 'exact' }).eq('user_id', user.id),
      supabaseAdmin.from('bookmarked_articles').select('id', { count: 'exact' }).eq('user_id', user.id),
    ]);

    // Get fetch status counts
    const { data: fetchStatuses } = await supabaseAdmin
      .from('fetch_status')
      .select('last_fetch_at, last_success_at');

    const recentFetches = fetchStatuses?.filter(s => {
      if (!s.last_fetch_at) return false;
      const lastFetch = new Date(s.last_fetch_at);
      const now = new Date();
      return (now.getTime() - lastFetch.getTime()) < 24 * 60 * 60 * 1000;
    }).length || 0;

    // Build database info response
    const tables: DatabaseTableInfo[] = [
      {
        table_name: 'feeds',
        row_count: feedsResult.count || 0,
        size_bytes: 0, // Supabase manages this
      },
      {
        table_name: 'articles',
        row_count: articlesResult.count || 0,
        size_bytes: 0,
      },
      {
        table_name: 'fetch_logs',
        row_count: fetchLogsResult.count || 0,
        size_bytes: 0,
      },
      {
        table_name: 'read_articles',
        row_count: readStatusResult.count || 0,
        size_bytes: 0,
      },
      {
        table_name: 'bookmarked_articles',
        row_count: bookmarksResult.count || 0,
        size_bytes: 0,
      },
    ];

    return NextResponse.json({
      tables,
      summary: {
        totalFeeds: feedsResult.count || 0,
        totalArticles: articlesResult.count || 0,
        totalLogs: fetchLogsResult.count || 0,
        recentFetches24h: recentFetches,
        storageType: 'supabase',
      },
    });
  } catch (error) {
    console.error('Data files error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
