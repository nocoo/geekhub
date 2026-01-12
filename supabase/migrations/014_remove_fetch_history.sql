-- Migration: Remove redundant fetch_history table
-- Keep fetch_logs as the sole source of fetch history/logging

-- Step 1: Drop foreign key references first (if any)
-- (fetch_history is referenced by feeds.id ON DELETE CASCADE, no manual action needed)

-- Step 2: Drop fetch_history table
DROP TABLE IF EXISTS fetch_history CASCADE;

-- Step 3: Remove RLS policy reference (already dropped with table)
-- The policy "Users can view fetch history for their feeds" is auto-removed

-- Step 4: Verify fetch_logs still exists
SELECT 'fetch_logs retained' as status;

-- Step 5: Check current row counts for reference
SELECT
  'fetch_logs' as table_name,
  COUNT(*) as row_count
FROM fetch_logs
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
