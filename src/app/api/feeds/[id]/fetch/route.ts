import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { FeedFetcher, FeedInfo } from '@/lib/feed-fetcher';

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

interface ProxyConfig {
  enabled: boolean;
  autoDetect: boolean;
  host: string;
  port: string;
}

interface RssHubConfig {
  enabled: boolean;
  url: string;
}

interface FetchRequestBody {
  proxy?: ProxyConfig;
  rsshub?: RssHubConfig;
}

// POST /api/feeds/[id]/fetch - 手动触发RSS抓取
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: FetchRequestBody = await request.json().catch(() => ({}));
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取feed信息
    const { data: feed, error: feedError } = await supabase
      .from('feeds')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (feedError || !feed) {
      return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
    }

    // 构造 FeedInfo
    const feedInfo: FeedInfo = {
      id: feed.id,
      url: feed.url,
      url_hash: feed.url_hash,
      title: feed.title,
      description: feed.description || undefined,
      site_url: feed.site_url || undefined,
      favicon_url: feed.favicon_url || undefined,
      fetch_interval_minutes: feed.fetch_interval_minutes || undefined,
    };

    // 创建 fetcher 并执行抓取（传递代理和 RssHub 配置）
    const fetcher = new FeedFetcher(feedInfo, body.proxy, body.rsshub);

    // 异步执行抓取任务
    (async () => {
      try {
        const result = await fetcher.fetch();

        // 更新数据库统计信息
        await supabase
          .from('feeds')
          .update({
            last_fetched_at: new Date().toISOString(),
            last_success_at: result.success ? new Date().toISOString() : feed.last_success_at,
            total_articles: (feed.total_articles || 0) + result.articlesNew,
            fetch_error: result.error || null,
          })
          .eq('id', id);
      } catch (error) {
        console.error('Fetch error:', error);
        await supabase
          .from('feeds')
          .update({
            last_fetched_at: new Date().toISOString(),
            fetch_error: error instanceof Error ? error.message : String(error),
          })
          .eq('id', id);
      }
    })();

    return NextResponse.json({
      success: true,
      message: 'Fetch task started',
      feedId: id,
      feedTitle: feed.title,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
