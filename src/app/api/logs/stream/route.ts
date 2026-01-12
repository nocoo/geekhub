import { NextRequest } from 'next/server';
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
        setAll() {
          // Read-only for SSE
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

// GET /api/logs/stream - SSE stream for real-time logs
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Get user's feeds
  const { data: feeds } = await supabase
    .from('feeds')
    .select('id, title')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (!feeds || feeds.length === 0) {
    return new Response('No feeds found', { status: 404 });
  }

  const feedIds = feeds.map(f => f.id);
  const feedTitleMap = new Map(feeds.map(f => [f.id, f.title]));

  // Store last fetched timestamp for each feed to detect changes
  const supabaseAdmin = getServiceClient();
  const { data: fetchStatuses } = await supabaseAdmin
    .from('fetch_status')
    .select('feed_id, last_fetch_at')
    .in('feed_id', feedIds);

  const feedFetchTimestamps = new Map<string, string>(
    fetchStatuses?.map(s => [s.feed_id, s.last_fetch_at || '']) || []
  );

  const encoder = new TextEncoder();

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: any, event = 'log') => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      let isFirstCheck = true;

      // Send initial connection message
      sendEvent({ type: 'connected', message: 'Connected to log stream' }, 'system');

      // Fetch and send initial logs from database
      const { data: logs } = await supabaseAdmin
        .from('fetch_logs')
        .select('fetched_at, level, status, action, url, duration_ms, message, feed_id')
        .in('feed_id', feedIds)
        .order('fetched_at', { ascending: true })
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

      sendEvent({ logs: formattedLogs }, 'init');

      // Set up polling interval for new logs
      const interval = setInterval(async () => {
        // Get latest logs for each feed
        const { data: newLogs } = await supabaseAdmin
          .from('fetch_logs')
          .select('fetched_at, level, status, action, url, duration_ms, message, feed_id')
          .in('feed_id', feedIds)
          .order('fetched_at', { ascending: false })
          .limit(10);

        if (newLogs && newLogs.length > 0) {
          const formattedNewLogs: LogLine[] = newLogs.map(log => ({
            timestamp: new Date(log.fetched_at).toISOString(),
            level: log.level,
            status: log.status,
            action: log.action,
            url: log.url,
            duration: log.duration_ms ? `(${log.duration_ms}ms)` : undefined,
            message: log.message,
            feedTitle: feedTitleMap.get(log.feed_id),
          })).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

          sendEvent({ logs: formattedNewLogs }, 'update');
        }

        // Check for feed fetch completion
        const { data: updatedStatuses } = await supabaseAdmin
          .from('fetch_status')
          .select('feed_id, last_fetch_at, total_articles')
          .in('feed_id', feedIds);

        if (updatedStatuses) {
          for (const updated of updatedStatuses) {
            const previousTimestamp = feedFetchTimestamps.get(updated.feed_id) || '';
            const currentTimestamp = updated.last_fetch_at || '';

            if (!isFirstCheck && previousTimestamp !== currentTimestamp) {
              sendEvent({
                feedId: updated.feed_id,
                lastFetchedAt: updated.last_fetch_at,
                totalArticles: updated.total_articles,
              }, 'fetch-complete');
            }

            feedFetchTimestamps.set(updated.feed_id, currentTimestamp);
          }
        }

        isFirstCheck = false;
      }, 3000);

      // Keep connection alive
      const keepAlive = setInterval(() => {
        sendEvent({ type: 'keepalive' }, 'keepalive');
      }, 15000);

      // Cleanup on connection close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        clearInterval(keepAlive);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
