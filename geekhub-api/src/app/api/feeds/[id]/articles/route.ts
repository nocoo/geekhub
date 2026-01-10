import { NextRequest, NextResponse } from 'next/server';
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

interface ArticleIndex {
  last_updated: string;
  total_count: number;
  articles: Array<{
    hash: string;
    title: string;
    url: string;
    published_at?: string;
    author?: string;
    summary?: string;
    file_path: string;
  }>;
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

    // 获取 feed 信息
    const { data: feed, error: feedError } = await supabase
      .from('feeds')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (feedError || !feed) {
      return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
    }

    const feedDir = join(process.cwd(), 'data', 'feeds', feed.url_hash);
    const indexFile = join(feedDir, 'index.json');

    // 尝试读取索引文件
    let index: ArticleIndex | null = null;
    try {
      const indexContent = await readFile(indexFile, 'utf-8');
      index = JSON.parse(indexContent);
    } catch {
      // 索引文件不存在，返回空数组
      return NextResponse.json({
        feed: {
          id: feed.id,
          title: feed.title,
          url: feed.url,
        },
        articles: [],
        total: 0,
      });
    }

    // 获取用户的阅读状态
    const { data: readArticles } = await supabase
      .from('read_articles')
      .select('article_hash')
      .eq('feed_id', id);

    const readHashes = new Set(readArticles?.map(ra => ra.article_hash) || []);

    // 构建文章列表，添加 feed 信息和阅读状态
    const articles = (index?.articles || []).map(article => ({
      id: article.hash,
      feedId: feed.id,
      title: article.title,
      url: article.url,
      description: article.summary || '',
      author: article.author || '',
      publishedAt: article.published_at ? new Date(article.published_at) : null,
      feedName: feed.title,
      feedIcon: feed.favicon_url || '',
      isRead: readHashes.has(article.hash),
      hash: article.hash,
    }));

    return NextResponse.json({
      feed: {
        id: feed.id,
        title: feed.title,
        url: feed.url,
      },
      articles,
      total: index?.total_count || 0,
      lastUpdated: index?.last_updated || null,
    });
  } catch (error) {
    console.error('Error loading articles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
