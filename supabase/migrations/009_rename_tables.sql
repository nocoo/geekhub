-- Migration 009: Rename feed_cache to fetch_status
-- Rename the fetch status cache table for clarity

-- ============================================
-- Rename feed_cache to fetch_status
-- ============================================

ALTER TABLE IF EXISTS feed_cache RENAME TO fetch_status;

-- ============================================
-- Update indexes
-- ============================================

DROP INDEX IF EXISTS idx_feed_cache_next_fetch;
CREATE INDEX IF NOT EXISTS idx_fetch_status_next_fetch ON fetch_status(next_fetch_at) WHERE next_fetch_at IS NOT NULL;

-- ============================================
-- Update RLS policies
-- ============================================

DROP POLICY IF EXISTS "Users can view cache for their feeds" ON fetch_status;
CREATE POLICY "Users can view fetch status for their feeds" ON fetch_status
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM feeds
      WHERE feeds.id = fetch_status.feed_id
      AND feeds.user_id = auth.uid()
    )
  );

-- ============================================
-- Update comments
-- ============================================

COMMENT ON TABLE fetch_status IS 'Fetch status and statistics cache for feeds';
