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

// POST /api/articles/[id]/read-later - Toggle read later
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: articleId } = await params;
    const body = await request.json();

    const supabase = await createSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(articleId)) {
      return NextResponse.json({ error: 'Invalid article ID format' }, { status: 400 });
    }

    // Check current read_later status
    const { data: existing } = await supabase
      .from('user_articles')
      .select('is_read_later, read_later_at')
      .eq('user_id', user.id)
      .eq('article_id', articleId)
      .maybeSingle();

    const newStatus = !existing?.is_read_later;
    const now = new Date().toISOString();

    // Toggle read_later
    const { error } = await supabase
      .from('user_articles')
      .upsert({
        user_id: user.id,
        article_id: articleId,
        is_read_later: newStatus,
        read_later_at: newStatus ? now : null,
      }, {
        onConflict: 'user_id,article_id'
      });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      readLater: newStatus,
      readLaterAt: newStatus ? now : null,
    });
  } catch (error) {
    console.error('[ReadLater] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to toggle read later' },
      { status: 500 }
    );
  }
}

// DELETE /api/articles/[id]/read-later - Remove from read later
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: articleId } = await params;
    const body = await request.json().catch(() => ({}));

    const supabase = await createSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(articleId)) {
      return NextResponse.json({ error: 'Invalid article ID format' }, { status: 400 });
    }

    // Remove read_later
    const { error } = await supabase
      .from('user_articles')
      .update({
        is_read_later: false,
        read_later_at: null,
      })
      .eq('user_id', user.id)
      .eq('article_id', articleId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ReadLater] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove from read later' },
      { status: 500 }
    );
  }
}
