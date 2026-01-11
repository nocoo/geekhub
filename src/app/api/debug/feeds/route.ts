import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { readFile, stat } from 'fs/promises';
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

// 计算Feed成功率（从日志中分析）
async function calculateSuccessRate(urlHash: string): Promise<number> {
  try {
    const logPath = join(process.cwd(), 'data', 'feeds', urlHash, 'fetch.log');
    const logContent = await readFile(logPath, 'utf-8');
    const logs = logContent.split('\n').filter(line => line.trim());

    if (logs.length === 0) return 0;

    // 分析最近50条日志
    const recentLogs = logs.slice(-50);
    const successCount = recentLogs.filter(log => log.includes('SUCCESS')).length;
    const errorCount = recentLogs.filter(log => log.includes('ERROR')).length;
    const totalAttempts = successCount + errorCount;

    if (totalAttempts === 0) return 100;
    return Math.round((successCount / totalAttempts) * 100);
  } catch {
    return 0;
  }
}

// 计算Feed存储大小
async function calculateStorageSize(urlHash: string): Promise<number> {
  try {
    const feedDir = join(process.cwd(), 'data', 'feeds', urlHash);

    // 计算整个feed目录的大小
    const calculateDirSize = async (dirPath: string): Promise<number> => {
      try {
        const { readdir } = await import('fs/promises');
        const entries = await readdir(dirPath, { withFileTypes: true });
        let totalSize = 0;

        for (const entry of entries) {
          const fullPath = join(dirPath, entry.name);
          if (entry.isDirectory()) {
            totalSize += await calculateDirSize(fullPath);
          } else {
            const stats = await stat(fullPath);
            totalSize += stats.size;
          }
        }

        return totalSize;
      } catch {
        return 0;
      }
    };

    return await calculateDirSize(feedDir);
  } catch {
    return 0;
  }
}

// 获取最后错误信息
async function getLastError(urlHash: string): Promise<string | undefined> {
  try {
    const logPath = join(process.cwd(), 'data', 'feeds', urlHash, 'fetch.log');
    const logContent = await readFile(logPath, 'utf-8');
    const logs = logContent.split('\n').filter(line => line.trim());

    // 找到最后一个ERROR日志
    for (let i = logs.length - 1; i >= 0; i--) {
      const log = logs[i];
      if (log.includes('ERROR')) {
        // 提取错误信息
        const match = log.match(/ERROR\s+(.+)$/);
        return match ? match[1] : 'Unknown error';
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

// GET /api/debug/feeds - 获取所有Feed的详细状态
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取所有Feed信息
    const { data: feeds, error: feedsError } = await supabase
      .from('feeds')
      .select('id, title, url, url_hash, is_active, last_fetched_at, total_articles, unread_count')
      .eq('user_id', user.id)
      .order('title');

    if (feedsError) {
      throw feedsError;
    }

    // 为每个Feed计算详细状态
    const feedStatuses = await Promise.all(
      feeds.map(async (feed) => {
        // 判断Feed状态
        let status: 'active' | 'error' | 'paused' | 'fetching' = 'paused';
        let errorMessage: string | undefined;

        if (feed.is_active) {
          // 检查是否有错误
          errorMessage = await getLastError(feed.url_hash);

          if (errorMessage) {
            status = 'error';
          } else if (feed.last_fetched_at) {
            const lastFetch = new Date(feed.last_fetched_at);
            const now = new Date();
            const hoursSinceLastFetch = (now.getTime() - lastFetch.getTime()) / (1000 * 60 * 60);

            // 如果超过24小时没有抓取，可能有问题
            if (hoursSinceLastFetch > 24) {
              status = 'error';
              errorMessage = 'Long time no fetch';
            } else {
              status = 'active';
            }
          } else {
            status = 'active'; // 新Feed，还没有抓取记录
          }
        }

        // 计算成功率和存储大小
        const [successRate, storageSize] = await Promise.all([
          calculateSuccessRate(feed.url_hash),
          calculateStorageSize(feed.url_hash)
        ]);

        return {
          id: feed.id,
          title: feed.title,
          url: feed.url,
          status,
          lastFetch: feed.last_fetched_at,
          successRate,
          errorMessage,
          articleCount: feed.total_articles || 0,
          storageSize,
        };
      })
    );

    return NextResponse.json(feedStatuses);
  } catch (error) {
    console.error('Debug feeds error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
