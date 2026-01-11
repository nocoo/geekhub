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

// POST /api/articles/[id]/read-later - 添加到稍后阅读
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { feedId, articleTitle, articleUrl } = body;

    const supabase = await createSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 检查是否已存在
    const { data: existing } = await supabase
      .from('read_later_articles')
      .select('id')
      .eq('user_id', user.id)
      .eq('article_hash', id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Already in read later' }, { status: 409 });
    }

    // 添加到稍后阅读
    const { data, error } = await supabase
      .from('read_later_articles')
      .insert({
        user_id: user.id,
        feed_id: feedId,
        article_hash: id,
        article_title: articleTitle,
        article_url: articleUrl,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, article: data });
  } catch (error) {
    console.error('[ReadLater] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save article' },
      { status: 500 }
    );
  }
}

// DELETE /api/articles/[id]/read-later - 从稍后阅读移除
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

    const { error } = await supabase
      .from('read_later_articles')
      .delete()
      .eq('user_id', user.id)
      .eq('article_hash', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ReadLater] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove article' },
      { status: 500 }
    );
  }
}
