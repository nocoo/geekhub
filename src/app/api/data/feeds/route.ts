import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSmartSupabaseClient } from '@/lib/supabase-server';

// Service role client for reading fetch_logs
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

// Calculate success rate from fetch_logs table
async function calculateSuccessRate(feedId: string): Promise<number> {
  try {
    const supabase = getServiceClient();
    const { data: logs } = await supabase
      .from('fetch_logs')
      .select('level')
      .eq('feed_id', feedId)
      .order('fetched_at', { ascending: false })
      .limit(50);

    if (!logs || logs.length === 0) return 100;

    const successCount = logs.filter(log => log.level === 'SUCCESS').length;
    const errorCount = logs.filter(log => log.level === 'ERROR').length;
    const totalAttempts = successCount + errorCount;

    if (totalAttempts === 0) return 100;
    return Math.round((successCount / totalAttempts) * 100);
  } catch {
    return 0;
  }
}

// Get last error message from fetch_logs table
async function getLastError(feedId: string): Promise<string | undefined> {
  try {
    const supabase = getServiceClient();
    const { data: log } = await supabase
      .from('fetch_logs')
      .select('message')
      .eq('feed_id', feedId)
      .eq('level', 'ERROR')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return log?.message || undefined;
  } catch {
    return undefined;
  }
}

// Get last fetch status from fetch_status table
async function getLastFetchStatus(feedId: string) {
  try {
    const supabase = getServiceClient();
    const { data: status } = await supabase
      .from('fetch_status')
      .select('last_fetch_at, last_success_at, last_fetch_status, next_fetch_at')
      .eq('feed_id', feedId)
      .maybeSingle();

    return status;
  } catch {
    return null;
  }
}

// GET /api/data/feeds - Get all feeds detailed status
export async function GET(request: NextRequest) {
  try {
    const { client: supabase, user } = await createSmartSupabaseClient();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

    // Get all feeds
    const { data: feeds, error: feedsError } = await supabase
      .from('feeds')
      .select('id, title, url, url_hash, is_active')
      .eq('user_id', user.id)
      .order('title');

    if (feedsError) {
      throw feedsError;
    }

    // Get feed IDs for batch query
    const feedIds = feeds.map(f => f.id);

    // Batch fetch fetch_status for all feeds
    let fetchStatusMap: Record<string, any> = {};
    if (feedIds.length > 0) {
      const supabaseAdmin = getServiceClient();
      const { data: allStatuses } = await supabaseAdmin
        .from('fetch_status')
        .select('feed_id, last_fetch_at, last_success_at, last_fetch_status, next_fetch_at, total_articles')
        .in('feed_id', feedIds);

      if (allStatuses) {
        fetchStatusMap = Object.fromEntries(allStatuses.map(s => [s.feed_id, s]));
      }
    }

    // Calculate status for each feed
    const feedStatuses = await Promise.all(
      feeds.map(async (feed) => {
        const fetchStatus = fetchStatusMap[feed.id];
        const status = 'active'; // Default to active, can be refined based on last_fetch_at
        const errorMessage = await getLastError(feed.id);
        const successRate = await calculateSuccessRate(feed.id);

        // Determine status based on fetch status
        let currentStatus: 'active' | 'error' | 'paused' | 'fetching' = 'paused';

        if (feed.is_active) {
          if (errorMessage) {
            currentStatus = 'error';
          } else if (fetchStatus?.last_fetch_at) {
            const lastFetch = new Date(fetchStatus.last_fetch_at);
            const now = new Date();
            const hoursSinceLastFetch = (now.getTime() - lastFetch.getTime()) / (1000 * 60 * 60);

            if (hoursSinceLastFetch > 24) {
              currentStatus = 'error';
              errorMessage || 'Long time no fetch';
            } else {
              currentStatus = 'active';
            }
          } else {
            currentStatus = 'active';
          }
        }

        return {
          id: feed.id,
          title: feed.title,
          url: feed.url,
          status: currentStatus,
          lastFetch: fetchStatus?.last_fetch_at,
          successRate,
          errorMessage,
          articleCount: fetchStatus?.total_articles || 0,
          storageSize: 0, // No longer tracking storage size in file system
        };
      })
    );

    return NextResponse.json(feedStatuses);
  } catch (error) {
    console.error('Data feeds error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
