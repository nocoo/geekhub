-- Migration 013: Reset article data for fresh sync
-- CAUTION: This will delete all article data, user read status, and stats

-- Step 1: Disable triggers temporarily to avoid issues
ALTER TABLE user_articles DISABLE TRIGGER ALL;
ALTER TABLE articles DISABLE TRIGGER ALL;

-- Step 2: Delete all user_articles records
TRUNCATE TABLE user_articles RESTART IDENTITY CASCADE;
COMMENT ON TABLE user_articles IS 'User interactions with articles (cleared for fresh sync)';

-- Step 3: Delete all articles
TRUNCATE TABLE articles RESTART IDENTITY CASCADE;
COMMENT ON TABLE articles IS 'Article content fetched from RSS feeds (cleared for fresh sync)';

-- Step 4: Reset fetch_status counters
TRUNCATE TABLE fetch_status RESTART IDENTITY CASCADE;
COMMENT ON TABLE fetch_status IS 'Fetch status and statistics cache for feeds (cleared for fresh sync)';

-- Step 5: Reset user_feed_stats
TRUNCATE TABLE user_feed_stats RESTART IDENTITY CASCADE;
COMMENT ON TABLE user_feed_stats IS 'Per-user per-feed unread count cache (cleared for fresh sync)';

-- Step 6: Clear fetch_logs (optional - keep if you want history)
-- TRUNCATE TABLE fetch_logs RESTART IDENTITY CASCADE;

-- Step 7: Re-enable triggers
ALTER TABLE user_articles ENABLE TRIGGER ALL;
ALTER TABLE articles ENABLE TRIGGER ALL;

-- Step 8: Verify counts
SELECT
  'articles' as table_name,
  COUNT(*) as row_count
FROM articles
UNION ALL
SELECT
  'user_articles',
  COUNT(*)
FROM user_articles
UNION ALL
SELECT
  'fetch_status',
  COUNT(*)
FROM fetch_status
UNION ALL
SELECT
  'user_feed_stats',
  COUNT(*)
FROM user_feed_stats;
