import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Service role client for reading fetch_logs
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

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

interface LogLine {
  timestamp: string;
  level: string;
  status?: number;
  action: string;
  url: string;
  duration?: string;
  message?: string;
  feedTitle?: string;
}

// GET /api/logs - Get recent fetch logs across all user's feeds from database
export async function GET(_request: NextRequest) {
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
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (feedsError || !feeds) {
      return NextResponse.json({ logs: [] });
    }

    const feedIds = feeds.map(f => f.id);
    const feedTitleMap = new Map(feeds.map(f => [f.id, f.title]));

    // Read logs from database
    const supabaseAdmin = getServiceClient();
    const { data: logs } = await supabaseAdmin
      .from('fetch_logs')
      .select('fetched_at, level, status, action, url, duration_ms, message, feed_id')
      .in('feed_id', feedIds)
      .order('fetched_at', { ascending: false })
      .limit(50);

    const formattedLogs: LogLine[] = (logs || []).map(log => ({
      timestamp: new Date(log.fetched_at).toISOString(),
      level: log.level,
      status: log.status,
      action: log.action,
      url: log.url,
      duration: log.duration_ms ? `(${log.duration_ms}ms)` : undefined,
      message: log.message,
      feedTitle: feedTitleMap.get(log.feed_id),
    }));

    return NextResponse.json({ logs: formattedLogs });
  } catch (error) {
    console.error('Logs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
