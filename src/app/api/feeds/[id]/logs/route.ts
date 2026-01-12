import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSmartSupabaseClient } from '@/lib/supabase-server';

// Service role client for reading fetch_logs and articles
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

// GET /api/feeds/[id]/logs - Get RSS fetch logs and articles from database
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { client: supabase, user } = await createSmartSupabaseClient();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

    // Get feed info
    const { data: feed, error: feedError } = await supabase
      .from('feeds')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (feedError || !feed) {
      return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
    }

    // Get fetch logs from database
    const supabaseAdmin = getServiceClient();
    const { data: fetchLogs } = await supabaseAdmin
      .from('fetch_logs')
      .select('fetched_at, level, action, url, duration_ms, message')
      .eq('feed_id', id)
      .order('fetched_at', { ascending: false })
      .limit(100);

    // Format logs as strings
    const logs: string[] = (fetchLogs || []).reverse().map(log => {
      const timestamp = new Date(log.fetched_at).toISOString().slice(0, 19).replace('T', ' ');
      const duration = log.duration_ms ? `(${log.duration_ms}ms)` : '';
      const parts = [log.action, log.url, duration, log.message].filter(Boolean);
      return `[${timestamp}] ${log.level} ${parts.join(' ')}`;
    });

    if (logs.length === 0) {
      logs.push('No logs available yet');
    }

    // Get articles from database
    const { data: articles } = await supabaseAdmin
      .from('articles')
      .select('title, url, published_at, fetched_at')
      .eq('feed_id', id)
      .order('published_at', { ascending: false })
      .limit(100);

    const formattedArticles = (articles || []).map(article => ({
      path: article.url,
      title: article.title || 'Untitled',
      date: article.published_at || article.fetched_at,
      size: 0, // Size not stored in database
    }));

    // Get fetch status
    const { data: fetchStatus } = await supabaseAdmin
      .from('fetch_status')
      .select('last_fetch_at, total_articles')
      .eq('feed_id', id)
      .single();

    return NextResponse.json({
      feed: {
        id: feed.id,
        title: feed.title,
        url: feed.url,
        url_hash: feed.url_hash,
        last_fetched_at: fetchStatus?.last_fetch_at || feed.last_fetched_at,
        total_articles: fetchStatus?.total_articles || feed.total_articles,
      },
      logs,
      articles: formattedArticles,
      stats: {
        totalArticles: formattedArticles.length,
        totalSize: 0, // No longer tracking file size
      },
    });
  } catch (error) {
    console.error('Feed logs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
