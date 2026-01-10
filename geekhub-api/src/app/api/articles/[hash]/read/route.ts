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

// POST /api/articles/[hash]/read - Mark article as read
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { feedId } = body;

    if (!feedId) {
      return NextResponse.json({ error: 'feedId is required' }, { status: 400 });
    }

    // Check if article is already marked as read
    const { data: existing } = await supabase
      .from('read_articles')
      .select('*')
      .eq('user_id', user.id)
      .eq('feed_id', feedId)
      .eq('article_hash', hash)
      .maybeSingle();

    if (existing) {
      // Already marked as read, return success
      return NextResponse.json({ success: true, alreadyRead: true });
    }

    // Mark as read
    const { error } = await supabase
      .from('read_articles')
      .insert({
        user_id: user.id,
        feed_id: feedId,
        article_hash: hash,
        read_at: new Date().toISOString(),
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, alreadyRead: false });
  } catch (error) {
    console.error('Error marking article as read:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
