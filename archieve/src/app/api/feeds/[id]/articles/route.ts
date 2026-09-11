import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSmartSupabaseClient } from '@/lib/supabase-server';
import { ArticleViewModelService } from '@/lib/article-view-model';

// Create a service role client for view model operations
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

// GET /api/feeds/[id]/articles - Get articles for a feed
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { client: supabase, user } = await createSmartSupabaseClient();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

    // Get feed from database
    const { data: feed, error: feedError } = await supabase
      .from('feeds')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (feedError || !feed) {
      return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
    }

    // Get read article IDs
    const { data: readStatus, error: readError } = await supabase
      .from('user_articles')
      .select('article_id')
      .eq('user_id', user.id)
      .eq('is_read', true);

    if (readError) {
      console.error('Error fetching read status:', readError);
    }

    const readArticleIds = new Set(
      readStatus?.map(rs => rs.article_id) || []
    );

    // Get articles using view model with service role client
    const viewModel = new ArticleViewModelService(getServiceClient());
    const result = await viewModel.getArticlesForFeed(
      feed.id,
      feed.title,
      feed.favicon_url || '',
      readArticleIds
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error loading articles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
