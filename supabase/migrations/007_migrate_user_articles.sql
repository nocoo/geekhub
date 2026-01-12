-- Migration 007: Migrate user articles from old tables to user_articles
-- This migration consolidates read_articles, bookmarked_articles, and read_later_articles
-- into a single user_articles table

-- Note: This migration must run AFTER 006_add_new_tables.sql and AFTER
-- articles have been migrated from the file system (via scripts/migrate-articles.ts)

-- ============================================
-- Migration step: read_articles → user_articles
-- ============================================

-- Insert read status from read_articles to user_articles
-- We need to match article_hash to article_id from the articles table
INSERT INTO user_articles (user_id, article_id, is_read, read_at)
SELECT
  ra.user_id,
  a.id AS article_id,
  TRUE AS is_read,
  ra.read_at
FROM read_articles ra
INNER JOIN feeds f ON ra.feed_id = f.id
INNER JOIN articles a ON (
  a.feed_id = f.id
  AND a.hash = ra.article_hash
)
ON CONFLICT (user_id, article_id) DO UPDATE SET
  is_read = EXCLUDED.is_read,
  read_at = EXCLUDED.read_at;

-- ============================================
-- Migration step: bookmarked_articles → user_articles
-- ============================================

-- Insert bookmarks from bookmarked_articles to user_articles
INSERT INTO user_articles (user_id, article_id, is_bookmarked, bookmarked_at, notes)
SELECT
  ba.user_id,
  a.id AS article_id,
  TRUE AS is_bookmarked,
  ba.bookmarked_at AS bookmarked_at,
  ba.notes
FROM bookmarked_articles ba
INNER JOIN feeds f ON ba.feed_id = f.id
INNER JOIN articles a ON (
  a.feed_id = f.id
  AND a.hash = ba.article_hash
)
ON CONFLICT (user_id, article_id) DO UPDATE SET
  is_bookmarked = EXCLUDED.is_bookmarked,
  bookmarked_at = EXCLUDED.bookmarked_at,
  notes = COALESCE(EXCLUDED.notes, user_articles.notes);

-- ============================================
-- Migration step: read_later_articles → user_articles
-- ============================================

-- Insert read later from read_later_articles to user_articles
INSERT INTO user_articles (user_id, article_id, is_read_later, read_later_at)
SELECT
  rla.user_id,
  a.id AS article_id,
  TRUE AS is_read_later,
  rla.saved_at AS read_later_at
FROM read_later_articles rla
INNER JOIN feeds f ON rla.feed_id = f.id
INNER JOIN articles a ON (
  a.feed_id = f.id
  AND a.hash = rla.article_hash
)
ON CONFLICT (user_id, article_id) DO UPDATE SET
  is_read_later = EXCLUDED.is_read_later,
  read_later_at = EXCLUDED.read_later_at;

-- ============================================
-- Verification: Check migration results
-- ============================================

-- Count migrated records (for verification, run manually)
-- SELECT 'read_articles' as source, COUNT(*) FROM read_articles;
-- SELECT 'bookmarked_articles' as source, COUNT(*) FROM bookmarked_articles;
-- SELECT 'read_later_articles' as source, COUNT(*) FROM read_later_articles;
-- SELECT 'user_articles is_read' as migrated, COUNT(*) FROM user_articles WHERE is_read = TRUE;
-- SELECT 'user_articles is_bookmarked' as migrated, COUNT(*) FROM user_articles WHERE is_bookmarked = TRUE;
-- SELECT 'user_articles is_read_later' as migrated, COUNT(*) FROM user_articles WHERE is_read_later = TRUE;

-- ============================================
-- Note: Old tables will be dropped in a later migration (008)
-- after verification is complete
-- ============================================
