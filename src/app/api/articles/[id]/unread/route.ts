import { NextRequest, NextResponse } from 'next/server';
import { createSmartSupabaseClient } from '@/lib/supabase-server';

// POST /api/articles/[id]/unread - Mark article as unread
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: articleId } = await params;

    const { client: supabase, user } = await createSmartSupabaseClient();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(articleId)) {
      return NextResponse.json({ error: 'Invalid article ID format' }, { status: 400 });
    }

    // Mark as unread in user_articles using articleId directly
    const { error: updateError } = await supabase
      .from('user_articles')
      .update({
        is_read: false,
        read_at: null,
      })
      .eq('user_id', user.id)
      .eq('article_id', articleId);

    if (updateError) {
      console.error('Error marking article as unread:', updateError);
      return NextResponse.json({ error: 'Failed to mark as unread' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in /api/articles/[id]/unread:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
