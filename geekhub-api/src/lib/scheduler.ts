import * as cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import { FeedFetcher, FeedInfo } from './feed-fetcher';

interface FeedRow {
  id: string;
  url: string;
  url_hash: string;
  title: string;
  description?: string | null;
  site_url?: string | null;
  favicon_url?: string | null;
  fetch_interval_minutes?: number | null;
  last_fetched_at?: string | null;
  last_success_at?: string | null;
  total_articles?: number | null;
  is_active: boolean;
  fetch_error?: string | null;
}

export interface SchedulerOptions {
  supabaseUrl: string;
  supabaseKey: string;
  cronPattern?: string;
  onFetchStart?: (feed: FeedInfo) => void;
  onFetchComplete?: (feed: FeedInfo, result: Awaited<ReturnType<FeedFetcher['fetch']>>) => void;
  onFetchError?: (feed: FeedInfo, error: Error) => void;
  onLog?: (message: string) => void;
}

export class FeedScheduler {
  private scheduledTask: cron.ScheduledTask | null = null;
  private isRunning = false;
  private supabase: ReturnType<typeof createClient>;

  constructor(private options: SchedulerOptions) {
    this.supabase = createClient(options.supabaseUrl, options.supabaseKey);
  }

  log(message: string): void {
    this.options.onLog?.(message);
    console.log(`[Scheduler] ${message}`);
  }

  async fetchFeedsDueForUpdate(): Promise<void> {
    if (this.isRunning) {
      this.log('Already running, skipping this cycle');
      return;
    }

    this.isRunning = true;
    this.log(`Starting fetch cycle at ${new Date().toISOString()}`);

    try {
      const now = new Date();
      const { data: feeds, error } = await this.supabase
        .from('feeds')
        .select('*')
        .eq('is_active', true)
        .returns<FeedRow[]>();

      if (error) {
        throw new Error(`Failed to fetch feeds: ${error.message}`);
      }

      if (!feeds || feeds.length === 0) {
        this.log('No active feeds found');
        return;
      }

      this.log(`Found ${feeds.length} active feeds`);

      let fetchCount = 0;
      let skippedCount = 0;

      for (const feed of feeds) {
        const feedInfo: FeedInfo = {
          id: feed.id,
          url: feed.url,
          url_hash: feed.url_hash,
          title: feed.title,
          description: feed.description || undefined,
          site_url: feed.site_url || undefined,
          favicon_url: feed.favicon_url || undefined,
          fetch_interval_minutes: feed.fetch_interval_minutes || 60,
        };

        // Check if feed needs to be fetched
        const lastFetched = feed.last_fetched_at ? new Date(feed.last_fetched_at) : null;
        const intervalMs = (feed.fetch_interval_minutes || 60) * 60 * 1000;
        const shouldFetch = !lastFetched || (now.getTime() - lastFetched.getTime() >= intervalMs);

        if (!shouldFetch) {
          skippedCount++;
          continue;
        }

        fetchCount++;
        this.options.onFetchStart?.(feedInfo);

        try {
          const fetcher = new FeedFetcher(feedInfo);
          const result = await fetcher.fetch();

          // Update database
          // @ts-ignore
          await (this.supabase.from('feeds') as any)
            .update({
              last_fetched_at: now.toISOString(),
              last_success_at: result.success ? now.toISOString() : feed.last_success_at || undefined,
              total_articles: (feed.total_articles || 0) + result.articlesNew,
              fetch_error: result.error || null,
            })
            .eq('id', feed.id)
            .then();

          this.options.onFetchComplete?.(feedInfo, result);
          this.log(`Fetched "${feed.title}": ${result.articlesNew} new articles (${result.duration})`);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.options.onFetchError?.(feedInfo, err);
          this.log(`Error fetching "${feed.title}": ${err.message}`);

          // Update error in database
          // @ts-ignore
          await (this.supabase.from('feeds') as any)
            .update({
              last_fetched_at: now.toISOString(),
              fetch_error: err.message,
            })
            .eq('id', feed.id)
            .then();
        }
      }

      this.log(`Fetch cycle complete: ${fetchCount} fetched, ${skippedCount} skipped`);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.log(`Scheduler error: ${err.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  start(): void {
    if (this.scheduledTask) {
      this.log('Scheduler is already running');
      return;
    }

    const pattern = this.options.cronPattern || '*/15 * * * *'; // Every 15 minutes by default
    this.log(`Starting scheduler with pattern: ${pattern}`);

    this.scheduledTask = cron.schedule(pattern, () => {
      this.fetchFeedsDueForUpdate();
    });

    // Run once immediately
    this.fetchFeedsDueForUpdate();
  }

  stop(): void {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask = null;
      this.log('Scheduler stopped');
    }
  }

  // Manual trigger
  async trigger(): Promise<void> {
    this.log('Manually triggering fetch cycle');
    await this.fetchFeedsDueForUpdate();
  }

  getStatus(): { running: boolean; isFetching: boolean } {
    return {
      running: this.scheduledTask !== null,
      isFetching: this.isRunning,
    };
  }
}
