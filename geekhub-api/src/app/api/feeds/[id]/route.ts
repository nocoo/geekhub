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

// PUT /api/feeds/[id] - 更新 RSS 源
export async function PUT(
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

    const body = await request.json();
    const { title, description, category_id, is_active, fetch_interval_minutes } = body;

    const { data: feed, error } = await supabase
      .from('feeds')
      .update({
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(category_id !== undefined && { category_id }),
        ...(is_active !== undefined && { is_active }),
        ...(fetch_interval_minutes && { fetch_interval_minutes }),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select(`
        *,
        category:categories(id, name, color, icon)
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // no rows returned
        return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ feed });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/feeds/[id] - 删除 RSS 源
export async function DELETE(
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

    // 获取要删除的 feed 信息（用于清理文件）
    const { data: feed, error: fetchError } = await supabase
      .from('feeds')
      .select('url_hash')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // 删除相关的已读记录和收藏记录
    await supabase.from('read_articles').delete().eq('feed_id', id);
    await supabase.from('bookmarked_articles').delete().eq('feed_id', id);

    // 删除 RSS 源
    const { error } = await supabase
      .from('feeds')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // TODO: 在这里可以添加删除文件系统中对应文件夹的逻辑
    // 删除 data/feeds/{url_hash} 目录

    return NextResponse.json({ success: true, url_hash: feed.url_hash });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}