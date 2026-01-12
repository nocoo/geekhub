import { NextRequest, NextResponse } from 'next/server';
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

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  feedId: string;
  feedTitle: string;
  message: string;
}

// GET /api/data/logs - 获取聚合的所有Feed日志
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's feeds
    const { data: feeds, error: feedsError } = await supabase
      .from('feeds')
      .select('id, title')
      .eq('user_id', user.id);

    if (feedsError) {
      throw feedsError;
    }

    const feedIds = feeds?.map(f => f.id) || [];

    if (feedIds.length === 0) {
      return NextResponse.json([]);
    }

    // Query logs from database
    const { data: logs, error: logsError } = await supabase
      .from('fetch_logs')
      .select(`
        fetched_at,
        level,
        action,
        url,
        duration_ms,
        message,
        feed_id
      `)
      .in('feed_id', feedIds)
      .order('fetched_at', { ascending: false })
      .limit(500);

    if (logsError) {
      throw logsError;
    }

    // Build feed title map
    const feedTitleMap = new Map(feeds?.map(f => [f.id, f.title]) || []);

    // Transform to LogEntry format
    const aggregatedLogs: LogEntry[] = (logs || []).map(log => ({
      timestamp: log.fetched_at,
      level: log.level as LogEntry['level'],
      feedId: log.feed_id,
      feedTitle: feedTitleMap.get(log.feed_id) || 'Unknown Feed',
      message: [
        log.action,
        log.url,
        log.duration_ms ? `(${log.duration_ms}ms)` : '',
        log.message || '',
      ].filter(Boolean).join(' '),
    }));

    return NextResponse.json(aggregatedLogs);
  } catch (error) {
    console.error('Data logs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
