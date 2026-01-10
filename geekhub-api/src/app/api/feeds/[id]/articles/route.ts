import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ArticleViewModelService } from '@/lib/article-view-model';
import { ReadStatusService } from '@/lib/read-status-service';

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

// GET /api/feeds/[id]/articles - 获取已抓取的文章列表
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
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

    // Create services
    const viewModel = new ArticleViewModelService();
    const readStatusService = new ReadStatusService(user.id);

    // Get articles with view model
    const result = await viewModel.getArticlesForFeed(
      feed.id,
      feed.url_hash,
      feed.title,
      feed.favicon_url || '',
      readStatusService
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error loading articles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
