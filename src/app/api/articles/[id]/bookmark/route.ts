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

// POST /api/articles/[id]/bookmark - Toggle bookmark
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: articleId } = await params;
    const body = await request.json();
    const { notes } = body;

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

    // Check current bookmark status
    const { data: existing } = await supabase
      .from('user_articles')
      .select('is_bookmarked, bookmarked_at, notes')
      .eq('user_id', user.id)
      .eq('article_id', articleId)
      .maybeSingle();

    const newStatus = !existing?.is_bookmarked;
    const now = new Date().toISOString();

    // Toggle bookmark
    const { error } = await supabase
      .from('user_articles')
      .upsert({
        user_id: user.id,
        article_id: articleId,
        is_bookmarked: newStatus,
        bookmarked_at: newStatus ? now : null,
        notes: newStatus ? notes : null,
      }, {
        onConflict: 'user_id,article_id'
      });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      bookmarked: newStatus,
      bookmarkedAt: newStatus ? now : null,
    });
  } catch (error) {
    console.error('[Bookmark] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to toggle bookmark' },
      { status: 500 }
    );
  }
}

// DELETE /api/articles/[id]/bookmark - Remove bookmark
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

    // Remove bookmark
    const { error } = await supabase
      .from('user_articles')
      .update({
        is_bookmarked: false,
        bookmarked_at: null,
      })
      .eq('user_id', user.id)
      .eq('article_id', articleId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Bookmark] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove bookmark' },
      { status: 500 }
    );
  }
}
