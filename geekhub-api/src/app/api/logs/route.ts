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

interface ParsedLogLine {
  timestamp: string;
  level: string;
  status?: number;
  action: string;
  url: string;
  duration?: string;
  message?: string;
}

function parseLogLine(line: string): ParsedLogLine | null {
  // Expected format: [timestamp] LEVEL [STATUS] ACTION URL (duration) - message
  const regex = /^\[([^\]]+)\]\s+(\w+)\s+(?:\[(\d+)\]\s+)?(\w+)\s+(.+?)(?:\s+\((\d+ms)\))?(?:\s+-\s+(.+))?$/;
  const match = line.match(regex);

  if (!match) return null;

  const [, timestamp, level, status, action, url, duration, message] = match;

  return {
    timestamp,
    level,
    status: status ? parseInt(status, 10) : undefined,
    action,
    url,
    duration,
    message,
  };
}

// GET /api/logs - Get recent fetch logs across all user's feeds
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's feeds
    const { data: feeds, error: feedsError } = await supabase
      .from('feeds')
      .select('id, url_hash, title')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (feedsError || !feeds) {
      return NextResponse.json({ logs: [] });
    }

    const dataDir = join(process.cwd(), 'data', 'feeds');
    const allLogs: ParsedLogLine[] = [];

    // Read logs from each feed
    for (const feed of feeds) {
      try {
        const logPath = join(dataDir, feed.url_hash, 'fetch.log');
        const content = await readFile(logPath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());

        for (const line of lines) {
          const parsed = parseLogLine(line);
          if (parsed) {
            // Add feed title to context
            (parsed as any).feedTitle = feed.title;
            allLogs.push(parsed);
          }
        }
      } catch {
        // Feed has no logs yet, skip
      }
    }

    // Sort by timestamp descending and get latest 50
    const sortedLogs = allLogs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 50);

    return NextResponse.json({ logs: sortedLogs });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
