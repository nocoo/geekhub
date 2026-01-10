import { NextRequest } from 'next/server';
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
        setAll() {
          // Read-only for SSE
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

// GET /api/logs/stream - SSE stream for real-time logs
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Get user's feeds
  const { data: feeds } = await supabase
    .from('feeds')
    .select('id, url_hash, title')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (!feeds) {
    return new Response('No feeds found', { status: 404 });
  }

  const encoder = new TextEncoder();

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: any, event = 'log') => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Send initial connection message
      sendEvent({ type: 'connected', message: 'Connected to log stream' }, 'system');

      // Fetch and send initial logs
      const dataDir = join(process.cwd(), 'data', 'feeds');
      const allLogs: ParsedLogLine[] = [];

      for (const feed of feeds) {
        try {
          const logPath = join(dataDir, feed.url_hash, 'fetch.log');
          const content = await readFile(logPath, 'utf-8');
          const lines = content.split('\n').filter(line => line.trim());

          for (const line of lines) {
            const parsed = parseLogLine(line);
            if (parsed) {
              (parsed as any).feedTitle = feed.title;
              allLogs.push(parsed);
            }
          }
        } catch {
          // Feed has no logs yet, skip
        }
      }

      // Sort by timestamp and send
      const sortedLogs = allLogs
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .slice(-50); // Only send latest 50

      sendEvent({ logs: sortedLogs }, 'init');

      // Set up file watching interval
      const interval = setInterval(async () => {
        const newLogs: ParsedLogLine[] = [];

        for (const feed of feeds) {
          try {
            const logPath = join(dataDir, feed.url_hash, 'fetch.log');
            const content = await readFile(logPath, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim());

            // Get last 5 lines only
            const recentLines = lines.slice(-5);
            for (const line of recentLines) {
              const parsed = parseLogLine(line);
              if (parsed) {
                (parsed as any).feedTitle = feed.title;
                newLogs.push(parsed);
              }
            }
          } catch {
            // Feed has no logs yet, skip
          }
        }

        if (newLogs.length > 0) {
          // Sort by timestamp and send
          const sorted = newLogs.sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          sendEvent({ logs: sorted }, 'update');
        }
      }, 3000); // Check every 3 seconds

      // Keep connection alive
      const keepAlive = setInterval(() => {
        sendEvent({ type: 'keepalive' }, 'keepalive');
      }, 15000);

      // Cleanup on connection close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        clearInterval(keepAlive);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
