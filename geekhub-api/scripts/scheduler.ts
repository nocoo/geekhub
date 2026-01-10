#!/usr/bin/env tsx

/**
 * GeekHub RSS Feed Scheduler
 *
 * This script runs the feed scheduler as a standalone process.
 * It will fetch RSS feeds based on their configured intervals.
 *
 * Usage:
 *   npm run scheduler          # Start scheduler (every 15 min)
 *   npm run scheduler -- --trigger  # Trigger immediate fetch
 *   npm run scheduler -- --cron "*/5 * * * *"  # Custom cron pattern
 *
 * Environment variables (required):
 *   NEXT_PUBLIC_SUPABASE_URL - Your Supabase project URL
 *   SUPABASE_SERVICE_KEY - Your Supabase service role key
 */

import { FeedScheduler } from '../src/lib/scheduler';
import { FeedInfo } from '../src/lib/feed-fetcher';

// Check environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY');
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
const triggerOnly = args.includes('--trigger');
const cronIndex = args.indexOf('--cron');
const cronPattern = cronIndex >= 0 ? args[cronIndex + 1] : undefined;

// Create scheduler
const scheduler = new FeedScheduler({
  supabaseUrl,
  supabaseKey,
  cronPattern,
  onFetchStart: (feed: FeedInfo) => {
    console.log(`🔄 Fetching: ${feed.title}`);
  },
  onFetchComplete: (feed: FeedInfo, result: any) => {
    const emoji = result.success ? '✅' : '❌';
    const newArticles = result.articlesNew > 0 ? ` (+${result.articlesNew} new)` : '';
    console.log(`${emoji} ${feed.title}${newArticles} [${result.duration}]`);
  },
  onFetchError: (feed: FeedInfo, error: Error) => {
    console.log(`❌ ${feed.title}: ${error.message}`);
  },
  onLog: (message: string) => {
    console.log(`[Scheduler] ${message}`);
  },
});

// Handle signals for graceful shutdown
const shutdown = () => {
  console.log('\n🛑 Stopping scheduler...');
  scheduler.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Run
if (triggerOnly) {
  console.log('🚀 Triggering immediate fetch cycle...\n');
  scheduler.trigger().then(() => {
    console.log('\n✅ Fetch cycle complete');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
} else {
  console.log('🚀 Starting GeekHub RSS Feed Scheduler...\n');
  console.log(`Press Ctrl+C to stop\n`);
  scheduler.start();
}
