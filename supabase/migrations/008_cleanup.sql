-- Migration 008: Clean up old tables
-- This migration removes the old user status tables that have been migrated to user_articles

-- ============================================
-- Drop old user status tables
-- ============================================

-- Drop read_articles table (migrated to user_articles)
DROP TABLE IF EXISTS read_articles;

-- Drop bookmarked_articles table (migrated to user_articles)
DROP TABLE IF EXISTS bookmarked_articles;

-- Drop read_later_articles table (migrated to user_articles)
DROP TABLE IF EXISTS read_later_articles;

-- ============================================
-- Note: feeds and categories tables are kept
-- They contain user configuration that should not be lost
-- ============================================
