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

// GET /api/data/stats - Get system statistics
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get feeds
    const { data: feeds, error: feedsError } = await supabase
      .from('feeds')
      .select('id, is_active, last_fetched_at, total_articles')
      .eq('user_id', user.id);

    if (feedsError) {
      throw feedsError;
    }

    // Calculate feed statistics
    const totalFeeds = feeds.length;
    const activeFeeds = feeds.filter(f => f.is_active).length;
    const errorFeeds = feeds.filter(f => {
      if (!f.is_active) return false;
      if (!f.last_fetched_at) return true;
      const lastFetch = new Date(f.last_fetched_at);
      const now = new Date();
      return (now.getTime() - lastFetch.getTime()) > 24 * 60 * 60 * 1000;
    }).length;
    const pausedFeeds = feeds.filter(f => !f.is_active).length;

    // Calculate article statistics
    const totalArticles = feeds.reduce((sum, f) => sum + (f.total_articles || 0), 0);

    // Calculate today's fetch count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayFetched = feeds.filter(f => {
      if (!f.last_fetched_at) return false;
      const lastFetch = new Date(f.last_fetched_at);
      return lastFetch >= today;
    }).length;

    const stats = {
      totalFeeds,
      activeFeeds,
      errorFeeds,
      pausedFeeds,
      totalArticles,
      todayFetched,
      storageSize: 0, // No longer tracking file system storage
      lastUpdate: new Date().toISOString(),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Data stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
