import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Service role client for cleanup operations
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

interface CleanupResult {
  deletedLogs: number;
  errors: string[];
}

// GET /api/data/cleanup - Check cleanup opportunities
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's feed IDs
    const { data: feeds, error: feedsError } = await supabase
      .from('feeds')
      .select('id')
      .eq('user_id', user.id);

    if (feedsError) {
      throw feedsError;
    }

    const feedIds = feeds.map(f => f.id);

    // Count old fetch logs (older than 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const supabaseAdmin = getServiceClient();
    const { count: oldLogsCount } = await supabaseAdmin
      .from('fetch_logs')
      .select('*', { count: 'exact', head: true })
      .in('feed_id', feedIds)
      .lt('fetched_at', thirtyDaysAgo.toISOString());

    return NextResponse.json({
      cleanupNeeded: {
        oldLogs: oldLogsCount || 0,
        recommendation: oldLogsCount && oldLogsCount > 0
          ? `Delete ${oldLogsCount} fetch logs older than 30 days`
          : 'No cleanup needed',
      },
    });
  } catch (error) {
    console.error('Data cleanup check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/data/cleanup - Execute cleanup operations
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { deleteOldLogs = false, olderThanDays = 30 } = body;

    const result: CleanupResult = {
      deletedLogs: 0,
      errors: [],
    };

    // Get user's feed IDs
    const { data: feeds, error: feedsError } = await supabase
      .from('feeds')
      .select('id')
      .eq('user_id', user.id);

    if (feedsError) {
      throw feedsError;
    }

    const feedIds = feeds.map(f => f.id);

    if (deleteOldLogs && feedIds.length > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const { error: deleteError } = await getServiceClient()
        .from('fetch_logs')
        .delete()
        .in('feed_id', feedIds)
        .lt('fetched_at', cutoffDate.toISOString());

      if (deleteError) {
        result.errors.push(`Failed to delete old logs: ${deleteError.message}`);
      } else {
        // Note: Supabase doesn't return deleted count in this way
        result.deletedLogs = 0; // Would need a count query to get exact number
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Data cleanup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
