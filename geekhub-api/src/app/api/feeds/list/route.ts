import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { readFile } from 'fs/promises';
import { join } from 'path';

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

// GET /api/feeds/list - 获取带未读数的 feeds 列表
export async function GET() {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all feeds with categories
    const { data: feeds, error: feedsError } = await supabase
      .from('feeds')
      .select(`
        *,
        category:categories(*)
      `)
      .eq('user_id', user.id)
      .order('title');

    if (feedsError) {
      return NextResponse.json({ error: feedsError.message }, { status: 500 });
    }

    // Calculate unread count for each feed
    const feedsWithCounts = await Promise.all(
      (feeds || []).map(async (feed: any) => {
        // Get total articles from index file
        let totalArticles = 0;
        try {
          const indexFile = join(process.cwd(), 'data', 'feeds', feed.url_hash, 'index.json');
          const content = await readFile(indexFile, 'utf-8');
          const index = JSON.parse(content);
          totalArticles = index.total_count || 0;
        } catch {
          // Index file doesn't exist
        }

        // Get read articles count from database
        const { data: readArticles } = await supabase
          .from('read_articles')
          .select('article_hash')
          .eq('feed_id', feed.id);

        const readCount = readArticles?.length || 0;
        const unreadCount = Math.max(0, totalArticles - readCount);

        return {
          ...feed,
          total_articles: totalArticles,
          unread_count: unreadCount,
        };
      })
    );

    return NextResponse.json({ feeds: feedsWithCounts });
  } catch (error) {
    console.error('Error loading feeds:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
