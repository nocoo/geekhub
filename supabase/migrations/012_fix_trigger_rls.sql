-- Migration 012: Fix trigger RLS issue by using SECURITY DEFINER
-- The triggers need to bypass RLS to update user_feed_stats

-- ============================================
-- 1. Recreate trigger functions with SECURITY DEFINER
-- ============================================

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS trg_user_articles_insert ON user_articles;
DROP TRIGGER IF EXISTS trg_user_articles_update ON user_articles;
DROP TRIGGER IF EXISTS trg_user_articles_delete ON user_articles;
DROP TRIGGER IF EXISTS trg_articles_insert ON articles;
DROP FUNCTION IF EXISTS maintain_user_feed_stats();
DROP FUNCTION IF EXISTS maintain_user_feed_stats_on_new_article();

-- Recreate function with SECURITY DEFINER
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

  -- Upsert the stats - SECURITY DEFINER allows bypassing RLS
  INSERT INTO user_feed_stats (user_id, feed_id, unread_count, total_count)
  VALUES (_user_id, _feed_id, _unread_count, _total_count)
  ON CONFLICT (user_id, feed_id) DO UPDATE SET
    unread_count = EXCLUDED.unread_count,
    total_count = EXCLUDED.total_count,
    updated_at = NOW();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. Function for new articles (also with SECURITY DEFINER)
-- ============================================

CREATE OR REPLACE FUNCTION maintain_user_feed_stats_on_new_article()
RETURNS TRIGGER AS $$
DECLARE
  _user_id UUID;
  _unread_count INTEGER;
  _total_count INTEGER;
BEGIN
  -- Get all users who have this feed
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

    -- Upsert the stats - SECURITY DEFINER allows bypassing RLS
    INSERT INTO user_feed_stats (user_id, feed_id, unread_count, total_count)
    VALUES (_user_id, NEW.feed_id, _unread_count, _total_count)
    ON CONFLICT (user_id, feed_id) DO UPDATE SET
      unread_count = EXCLUDED.unread_count,
      total_count = EXCLUDED.total_count,
      updated_at = NOW();
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. Recreate triggers
-- ============================================

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

CREATE TRIGGER trg_articles_insert
  AFTER INSERT ON articles
  FOR EACH ROW
  EXECUTE FUNCTION maintain_user_feed_stats_on_new_article();

-- ============================================
-- Comments
-- ============================================

COMMENT ON FUNCTION maintain_user_feed_stats() IS 'Trigger function to update feed stats (SECURITY DEFINER to bypass RLS)';
COMMENT ON FUNCTION maintain_user_feed_stats_on_new_article() IS 'Trigger function to update feed stats when new articles are added (SECURITY DEFINER to bypass RLS)';
