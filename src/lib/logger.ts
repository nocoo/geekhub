import { createClient } from '@supabase/supabase-js';

// Singleton Supabase client for logger
let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient(): ReturnType<typeof createClient> {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_KEY!;
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

export enum LogLevel {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

export interface FetchLogEntry {
  id?: string;
  feed_id?: string;
  timestamp: string;
  level: LogLevel;
  status?: number;
  action: string;
  url: string;
  duration_ms?: number;
  message?: string;
}

export class FeedLogger {
  constructor(
    private feedId: string,
    private urlHash: string
  ) {}

  private async saveToDatabase(entry: FetchLogEntry): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      await (supabase.from('fetch_logs') as any).insert({
        feed_id: this.feedId,
        fetched_at: entry.timestamp,
        level: entry.level,
        status: entry.status,
        action: entry.action,
        url: entry.url,
        duration_ms: entry.duration_ms,
        message: entry.message,
      });
    } catch (error) {
      console.error('Failed to save log to database:', error);
    }
  }

  async info(action: string, url: string, message?: string): Promise<void> {
    const entry: FetchLogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      action,
      url,
      message,
    };
    await this.saveToDatabase(entry);
  }

  async success(status: number, action: string, url: string, duration: string, message?: string): Promise<void> {
    const entry: FetchLogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.SUCCESS,
      status,
      action,
      url,
      duration_ms: parseInt(duration) || 0,
      message,
    };
    await this.saveToDatabase(entry);
  }

  async warning(action: string, url: string, message: string): Promise<void> {
    const entry: FetchLogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.WARNING,
      action,
      url,
      message,
    };
    await this.saveToDatabase(entry);
  }

  async error(action: string, url: string, error: Error | string): Promise<void> {
    const message = typeof error === 'string' ? error : error.message;
    const entry: FetchLogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      action,
      url,
      message,
    };
    await this.saveToDatabase(entry);
  }

  // For backward compatibility - read from database
  async getRecentLogs(limit: number = 100): Promise<FetchLogEntry[]> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await (supabase.from('fetch_logs') as any)
        .select('*')
        .eq('feed_id', this.feedId)
        .order('fetched_at', { ascending: false })
        .limit(limit);

      if (error || !data) {
        return [];
      }

      return data.reverse() as FetchLogEntry[];
    } catch {
      return [];
    }
  }

  // Clear logs - for backward compatibility (no-op in database mode)
  async clearLogs(): Promise<void> {
    // In database mode, we don't implement clearLogs as it would delete historical data
    // If needed, this could be implemented with a date filter
    console.warn('clearLogs() is not supported in database mode');
  }
}
