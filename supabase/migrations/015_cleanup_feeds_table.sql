-- Migration: Remove redundant columns from feeds table
-- These statistics are now maintained in user_feed_stats and fetch_status

-- Step 1: Remove redundant columns (use DROP COLUMN IF EXISTS for safety)
ALTER TABLE feeds DROP COLUMN IF EXISTS total_articles;
ALTER TABLE feeds DROP COLUMN IF EXISTS unread_count;
ALTER TABLE feeds DROP COLUMN IF EXISTS last_fetched_at;
ALTER TABLE feeds DROP COLUMN IF EXISTS last_success_at;
ALTER TABLE feeds DROP COLUMN IF EXISTS fetch_error;
ALTER TABLE feeds DROP COLUMN IF EXISTS site_url;

-- Step 2: Verify feeds table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'feeds'
ORDER BY ordinal_position;

-- Step 3: Current row count
SELECT COUNT(*) as feed_count FROM feeds;
