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

// GET /api/debug/stats - 获取系统统计信息
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取Feed统计
    const { data: feeds, error: feedsError } = await supabase
      .from('feeds')
      .select('id, is_active, last_fetched_at, total_articles')
      .eq('user_id', user.id);

    if (feedsError) {
      throw feedsError;
    }

    // 计算Feed状态统计
    const totalFeeds = feeds.length;
    const activeFeeds = feeds.filter(f => f.is_active).length;
    const errorFeeds = feeds.filter(f => {
      // 如果超过24小时没有抓取且是活跃的，认为是错误状态
      if (!f.is_active) return false;
      if (!f.last_fetched_at) return true;
      const lastFetch = new Date(f.last_fetched_at);
      const now = new Date();
      return (now.getTime() - lastFetch.getTime()) > 24 * 60 * 60 * 1000;
    }).length;
    const pausedFeeds = feeds.filter(f => !f.is_active).length;

    // 计算文章统计
    const totalArticles = feeds.reduce((sum, f) => sum + (f.total_articles || 0), 0);

    // 计算今日抓取数量（简化版，实际应该从日志中统计）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayFetched = feeds.filter(f => {
      if (!f.last_fetched_at) return false;
      const lastFetch = new Date(f.last_fetched_at);
      return lastFetch >= today;
    }).length;

    // 计算存储大小（需要读取文件系统，这里先用估算）
    const estimatedStorageSize = totalArticles * 2048; // 假设每篇文章平均2KB

    const stats = {
      totalFeeds,
      activeFeeds,
      errorFeeds,
      pausedFeeds,
      totalArticles,
      todayFetched,
      storageSize: estimatedStorageSize,
      lastUpdate: new Date().toISOString(),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Debug stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
