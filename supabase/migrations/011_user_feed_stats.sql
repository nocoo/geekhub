-- Migration 011: Add user_feed_stats table for cached unread counts
-- This table maintains per-user per-feed unread counts for fast retrieval

-- ============================================
-- 1. Create user_feed_stats table
-- ============================================
CREATE TABLE IF NOT EXISTS user_feed_stats (
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feed_id         UUID NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  unread_count    INTEGER NOT NULL DEFAULT 0,
  total_count     INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, feed_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_feed_stats_user_id ON user_feed_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feed_stats_feed_id ON user_feed_stats(feed_id);

-- ============================================
-- 2. RLS policies
-- ============================================
ALTER TABLE user_feed_stats ENABLE ROW LEVEL SECURITY;

-- Users can view their own feed stats
CREATE POLICY "Users can view their own feed stats" ON user_feed_stats
  FOR SELECT USING (auth.uid() = user_id);

-- No insert/update/delete through API (maintained by triggers only)

-- ============================================
-- 3. Trigger function to maintain unread counts
-- ============================================

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_user_feed_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_user_feed_stats_updated_at ON user_feed_stats;
CREATE TRIGGER update_user_feed_stats_updated_at
  BEFORE UPDATE ON user_feed_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_user_feed_stats_updated_at();

-- ============================================
-- 4. Initialize stats for all user-feed combinations
-- ============================================

-- Insert initial stats for existing data
INSERT INTO user_feed_stats (user_id, feed_id, unread_count, total_count)
SELECT
  f.user_id,
  f.id AS feed_id,
  COUNT(a.id) - COUNT(ua.id) FILTER (WHERE ua.is_read = TRUE) AS unread_count,
  COUNT(a.id) AS total_count
FROM feeds f
LEFT JOIN articles a ON f.id = a.feed_id
LEFT JOIN user_articles ua ON a.id = ua.article_id AND ua.is_read = TRUE
GROUP BY f.user_id, f.id
ON CONFLICT (user_id, feed_id) DO UPDATE SET
  unread_count = EXCLUDED.unread_count,
  total_count = EXCLUDED.total_count,
  updated_at = NOW();

-- ============================================
-- 5. Trigger function to maintain stats on user_articles changes
-- ============================================

CREATE OR REPLACE FUNCTION maintain_user_feed_stats()
RETURNS TRIGGER AS $$
DECLARE
  _feed_id UUID;
  _user_id UUID;
  _unread_count INTEGER;
  _total_count INTEGER;
BEGIN
  -- Get article's feed_id and user_id
  SELECT a.feed_id, ua.user_id
  INTO _feed_id, _user_id
  FROM articles a
  LEFT JOIN user_articles ua ON a.id = ua.article_id
  WHERE a.id = COALESCE(NEW.article_id, OLD.article_id)
  LIMIT 1;

  IF _feed_id IS NULL OR _user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Recalculate counts for this user-feed combination
  SELECT
    COUNT(a.id) - COUNT(ua.id) FILTER (WHERE ua.is_read = TRUE),
    COUNT(a.id)
  INTO _unread_count, _total_count
  FROM feeds f
  LEFT JOIN articles a ON f.id = a.feed_id
  LEFT JOIN user_articles ua ON a.id = ua.article_id
  WHERE f.id = _feed_id
    AND ua.user_id = _user_id;

  -- Upsert the stats
  INSERT INTO user_feed_stats (user_id, feed_id, unread_count, total_count)
  VALUES (_user_id, _feed_id, _unread_count, _total_count)
  ON CONFLICT (user_id, feed_id) DO UPDATE SET
    unread_count = EXCLUDED.unread_count,
    total_count = EXCLUDED.total_count,
    updated_at = NOW();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers for user_articles changes
DROP TRIGGER IF EXISTS trg_user_articles_insert ON user_articles;
DROP TRIGGER IF EXISTS trg_user_articles_update ON user_articles;
DROP TRIGGER IF EXISTS trg_user_articles_delete ON user_articles;

CREATE TRIGGER trg_user_articles_insert
  AFTER INSERT ON user_articles
  FOR EACH ROW
  EXECUTE FUNCTION maintain_user_feed_stats();

CREATE TRIGGER trg_user_articles_update
  AFTER UPDATE OF is_read, is_bookmarked, is_read_later ON user_articles
  FOR EACH ROW
  EXECUTE FUNCTION maintain_user_feed_stats();

CREATE TRIGGER trg_user_articles_delete
  AFTER DELETE ON user_articles
  FOR EACH ROW
  EXECUTE FUNCTION maintain_user_feed_stats();

-- ============================================
-- 6. Function to update stats when new articles are added
-- ============================================

CREATE OR REPLACE FUNCTION maintain_user_feed_stats_on_new_article()
RETURNS TRIGGER AS $$
DECLARE
  _user_id UUID;
  _unread_count INTEGER;
  _total_count INTEGER;
BEGIN
  -- Get all users who have this feed For
  -- each user, increment their unread count
  FOR _user_id IN
    SELECT DISTINCT f.user_id
    FROM feeds f
    WHERE f.id = NEW.feed_id
  LOOP
    -- Get counts for this user-feed
    SELECT
      COUNT(a.id) - COUNT(ua.id) FILTER (WHERE ua.is_read = TRUE),
      COUNT(a.id)
    INTO _unread_count, _total_count
    FROM feeds f
    LEFT JOIN articles a ON f.id = a.feed_id
    LEFT JOIN user_articles ua ON a.id = ua.article_id
    WHERE f.id = NEW.feed_id
      AND ua.user_id = _user_id;

    INSERT INTO user_feed_stats (user_id, feed_id, unread_count, total_count)
    VALUES (_user_id, NEW.feed_id, _unread_count, _total_count)
    ON CONFLICT (user_id, feed_id) DO UPDATE SET
      unread_count = EXCLUDED.unread_count,
      total_count = EXCLUDED.total_count,
      updated_at = NOW();
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new articles
DROP TRIGGER IF EXISTS trg_articles_insert ON articles;
CREATE TRIGGER trg_articles_insert
  AFTER INSERT ON articles
  FOR EACH ROW
  EXECUTE FUNCTION maintain_user_feed_stats_on_new_article();

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE user_feed_stats IS 'Per-user per-feed unread count cache, maintained by triggers';
COMMENT ON FUNCTION maintain_user_feed_stats() IS 'Trigger function to update feed stats when user_articles changes';
COMMENT ON FUNCTION maintain_user_feed_stats_on_new_article() IS 'Trigger function to update feed stats when new articles are added';
