import { NextRequest, NextResponse } from 'next/server';
import { createSmartSupabaseClient } from '@/lib/supabase-server';

// POST /api/feeds/[id]/mark-all-read - Mark all articles in a feed as read
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { client: supabase, user } = await createSmartSupabaseClient();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

    // Verify feed belongs to user
    const { data: feed } = await supabase
      .from('feeds')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!feed) {
      return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
    }

    // Get all article IDs from this feed
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('id')
      .eq('feed_id', id);

    if (articlesError) {
      return NextResponse.json({ error: articlesError.message }, { status: 500 });
    }

    if (!articles || articles.length === 0) {
      return NextResponse.json({ success: true, marked: 0, alreadyRead: 0 });
    }

    const articleIds = articles.map(a => a.id);

    // Get already read articles
    const { data: readStatus } = await supabase
      .from('user_articles')
      .select('article_id, is_read')
      .eq('user_id', user.id)
      .in('article_id', articleIds);

    const readArticleIds = new Set(
      readStatus?.filter(rs => rs.is_read).map(rs => rs.article_id) || []
    );

    const newArticleIds = articleIds.filter(id => !readArticleIds.has(id));

    if (newArticleIds.length === 0) {
      return NextResponse.json({ success: true, marked: 0, alreadyRead: articleIds.length });
    }

    // Bulk upsert read records
    const now = new Date().toISOString();
    const records = newArticleIds.map(articleId => ({
      user_id: user.id,
      article_id: articleId,
      is_read: true,
      read_at: now,
    }));

    const { error } = await supabase
      .from('user_articles')
      .upsert(records, {
        onConflict: 'user_id,article_id',
        ignoreDuplicates: false
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      marked: newArticleIds.length,
      alreadyRead: readArticleIds.size,
    });
  } catch (error) {
    console.error('Error marking all as read:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
