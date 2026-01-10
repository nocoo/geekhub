import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { readFile, readdir, stat } from 'fs/promises';
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

// GET /api/feeds/[id]/logs - 获取RSS抓取日志和文件信息
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const dataDir = join(process.cwd(), 'data', 'feeds', feed.url_hash);

    // 读取抓取日志
    let logs: string[] = [];
    try {
      const logPath = join(dataDir, 'fetch.log');
      const logContent = await readFile(logPath, 'utf-8');
      logs = logContent.split('\n').filter(line => line.trim());
    } catch {
      logs = ['No logs available yet'];
    }

    // 读取已抓取的文件列表
    let articles: Array<{
      path: string;
      title: string;
      date: string;
      size: number;
    }> = [];

    try {
      const articlesDir = join(dataDir, 'articles');
      const years = await readdir(articlesDir);

      for (const year of years) {
        const monthsPath = join(articlesDir, year);
        const months = await readdir(monthsPath);

        for (const month of months) {
          const monthPath = join(monthsPath, month);
          const files = await readdir(monthPath);

          for (const file of files) {
            const filePath = join(monthPath, file);
            const stats = await stat(filePath);

            try {
              const content = JSON.parse(await readFile(filePath, 'utf-8'));
              articles.push({
                path: `${year}/${month}/${file}`,
                title: content.title || 'Untitled',
                date: content.date || content.pubDate || new Date(stats.mtime).toISOString(),
                size: stats.size,
              });
            } catch {
              // 忽略解析失败的文件
            }
          }
        }
      }
    } catch {
      articles = [];
    }

    // 按日期排序
    articles.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      feed: {
        id: feed.id,
        title: feed.title,
        url: feed.url,
        url_hash: feed.url_hash,
        last_fetched_at: feed.last_fetched_at,
        total_articles: feed.total_articles,
      },
      logs: logs.slice(-100), // 只返回最近100条
      articles,
      stats: {
        totalArticles: articles.length,
        totalSize: articles.reduce((sum, a) => sum + a.size, 0),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
