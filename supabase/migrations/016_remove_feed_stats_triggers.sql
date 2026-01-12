-- Migration 016: Remove user_feed_stats trigger functions
-- These triggers are no longer needed since we calculate counts on read

-- Drop triggers
DROP TRIGGER IF EXISTS trg_user_articles_insert ON user_articles;
DROP TRIGGER IF EXISTS trg_user_articles_update ON user_articles;
DROP TRIGGER IF EXISTS trg_user_articles_delete ON user_articles;
DROP TRIGGER IF EXISTS trg_articles_insert ON articles;

-- Drop functions
DROP FUNCTION IF EXISTS maintain_user_feed_stats();
DROP FUNCTION IF EXISTS maintain_user_feed_stats_on_new_article();
DROP FUNCTION IF EXISTS update_user_feed_stats_updated_at();
