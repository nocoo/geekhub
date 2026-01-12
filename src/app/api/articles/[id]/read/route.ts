import { NextRequest, NextResponse } from 'next/server';
import { createSmartSupabaseClient } from '@/lib/supabase-server';

// POST /api/articles/[id]/read - Mark article as read
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

    // Mark as read in user_articles using articleId directly
    const { error: upsertError } = await supabase
      .from('user_articles')
      .upsert({
        user_id: user.id,
        article_id: articleId,
        is_read: true,
        read_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,article_id'
      });

    if (upsertError) {
      console.error('Error marking article as read:', upsertError);
      return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in /api/articles/[id]/read:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
