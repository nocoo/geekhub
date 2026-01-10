import { NextRequest, NextResponse } from 'next/server';
import { ArticleViewModelService } from '@/lib/article-view-model';
import { ReadStatusService } from '@/lib/read-status-service';
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

// GET /api/articles/[hash] - 获取单篇文章的完整内容
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find feed that contains this article
    const { data: feeds } = await supabase
      .from('feeds')
      .select('id, title, url_hash, favicon_url')
      .eq('user_id', user.id);

    if (!feeds || feeds.length === 0) {
      return NextResponse.json({ error: 'No feeds found' }, { status: 404 });
    }

    // Search for article in feeds
    const viewModel = new ArticleViewModelService();

    for (const feed of feeds) {
      try {
        const readStatusService = new ReadStatusService(user.id);
        const article = await viewModel.getArticle(
          feed.url_hash,
          hash,
          feed.id,
          feed.title,
          feed.favicon_url || '',
          readStatusService
        );

        if (article) {
          // Get full article content
          const { ArticleRepository } = await import('@/lib/article-repository');
          const repo = new ArticleRepository();
          const rawArticle = await repo.getArticle(feed.url_hash, hash);

          return NextResponse.json({
            ...article,
            content: rawArticle?.content,
            contentText: rawArticle?.content_text,
            tags: rawArticle?.tags || [],
            categories: rawArticle?.categories || [],
            enclosures: rawArticle?.enclosures || [],
          });
        }
      } catch {
        continue;
      }
    }

    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  } catch (error) {
    console.error('Error loading article:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
