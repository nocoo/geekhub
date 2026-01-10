import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { readFile, readdir } from 'fs/promises';
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

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  feedId: string;
  feedTitle: string;
  message: string;
}

// 解析日志行
function parseLogLine(line: string, feedId: string, feedTitle: string): LogEntry | null {
  const match = line.match(/^\[([^\]]+)\]\s+(\w+)\s+(.*)$/);
  if (!match) return null;

  const [, timestamp, level, message] = match;

  // 验证日志级别
  if (!['INFO', 'SUCCESS', 'WARNING', 'ERROR'].includes(level)) {
    return null;
  }

  return {
    timestamp,
    level: level as LogEntry['level'],
    feedId,
    feedTitle,
    message,
  };
}

// 聚合所有Feed的日志
async function aggregateLogs(feeds: Array<{ id: string; title: string; url_hash: string }>): Promise<LogEntry[]> {
  const allLogs: LogEntry[] = [];

  for (const feed of feeds) {
    try {
      const logPath = join(process.cwd(), 'data', 'feeds', feed.url_hash, 'fetch.log');
      const logContent = await readFile(logPath, 'utf-8');
      const lines = logContent.split('\n').filter(line => line.trim());

      // 只取最近100条日志，避免内存问题
      const recentLines = lines.slice(-100);

      for (const line of recentLines) {
        const logEntry = parseLogLine(line, feed.id, feed.title);
        if (logEntry) {
          allLogs.push(logEntry);
        }
      }
    } catch (error) {
      // 如果读取日志失败，添加一个错误日志条目
      allLogs.push({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        feedId: feed.id,
        feedTitle: feed.title,
        message: `Failed to read log file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  // 按时间戳排序（最新的在前）
  allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // 限制返回的日志数量，避免响应过大
  return allLogs.slice(0, 500);
}

// GET /api/debug/logs - 获取聚合的所有Feed日志
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取用户的所有Feed
    const { data: feeds, error: feedsError } = await supabase
      .from('feeds')
      .select('id, title, url_hash')
      .eq('user_id', user.id);

    if (feedsError) {
      throw feedsError;
    }

    // 聚合所有日志
    const aggregatedLogs = await aggregateLogs(feeds);

    return NextResponse.json(aggregatedLogs);
  } catch (error) {
    console.error('Debug logs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}