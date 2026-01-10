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

// POST /api/feeds/[id]/fetch - 手动触发RSS抓取
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取feed信息
    const { data: feed, error: feedError } = await supabase
      .from('feeds')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (feedError || !feed) {
      return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
    }

    // TODO: 实际触发RSS抓取任务
    // 这里应该：
    // 1. 调用RSS parser获取新文章
    // 2. 保存文章到 data/feeds/{url_hash}/articles/ 目录
    // 3. 更新数据库中的统计信息

    // 模拟异步任务启动
    const taskId = `fetch_${id}_${Date.now()}`;

    return NextResponse.json({
      success: true,
      message: 'Fetch task started',
      taskId,
      feedId: id,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
