-- Migration 006: Add new tables for cloud storage
-- This migration creates the core tables for storing articles and user interactions

-- ============================================
-- 1. articles table (文章内容)
-- ============================================
CREATE TABLE IF NOT EXISTS articles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feed_id         UUID NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  hash            TEXT NOT NULL,

  -- Article content
  title           TEXT NOT NULL,
  url             TEXT NOT NULL,
  link            TEXT,
  author          TEXT,
  published_at    TIMESTAMPTZ NOT NULL,
  content         TEXT,          -- HTML content
  content_text    TEXT,          -- Plain text
  summary         TEXT,          -- Summary
  categories      TEXT[],        -- Article categories
  tags            TEXT[],        -- Tags

  -- Metadata
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(feed_id, hash)
);

-- Indexes for articles
CREATE INDEX IF NOT EXISTS idx_articles_feed_id ON articles(feed_id);
CREATE INDEX IF NOT EXISTS idx_articles_hash ON articles(hash);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_fetched_at ON articles(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_feed_published ON articles(feed_id, published_at DESC);

-- ============================================
-- 2. fetch_status table (抓取状态缓存)
-- ============================================
CREATE TABLE IF NOT EXISTS fetch_status (
  feed_id                 UUID PRIMARY KEY REFERENCES feeds(id) ON DELETE CASCADE,

  -- Fetch status
  last_fetch_at           TIMESTAMPTZ,
  last_success_at         TIMESTAMPTZ,
  last_fetch_status       TEXT,          -- 'success', 'error', 'timeout'
  last_fetch_error        TEXT,
  last_fetch_duration_ms  INTEGER,

  -- Statistics cache (maintained by triggers)
  total_articles          INTEGER DEFAULT 0,
  unread_count            INTEGER DEFAULT 0,

  -- Next fetch time
  next_fetch_at           TIMESTAMPTZ
);

-- Indexes for fetch_status
CREATE INDEX IF NOT EXISTS idx_fetch_status_next_fetch ON fetch_status(next_fetch_at) WHERE next_fetch_at IS NOT NULL;

-- ============================================
-- 3. fetch_history table (抓取历史)
-- ============================================
CREATE TABLE IF NOT EXISTS fetch_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feed_id         UUID NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          TEXT NOT NULL,          -- 'success', 'error', 'timeout'
  duration_ms     INTEGER,
  articles_found  INTEGER,
  articles_new    INTEGER,
  error_message   TEXT
);

-- Indexes for fetch_history
CREATE INDEX IF NOT EXISTS idx_fetch_history_feed_id ON fetch_history(feed_id);
CREATE INDEX IF NOT EXISTS idx_fetch_history_fetched_at ON fetch_history(fetched_at DESC);

-- ============================================
-- 4. user_articles table (用户操作统一表)
-- ============================================
CREATE TABLE IF NOT EXISTS user_articles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id      UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,

  -- User actions
  is_read         BOOLEAN DEFAULT FALSE,
  is_bookmarked   BOOLEAN DEFAULT FALSE,
  is_read_later   BOOLEAN DEFAULT FALSE,

  -- Timestamps for each action
  read_at         TIMESTAMPTZ,
  bookmarked_at   TIMESTAMPTZ,
  read_later_at   TIMESTAMPTZ,

  -- Notes for bookmarked articles
  notes           TEXT,

  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, article_id)
);

-- Indexes for user_articles
CREATE INDEX IF NOT EXISTS idx_user_articles_user_id ON user_articles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_articles_article_id ON user_articles(article_id);
CREATE INDEX IF NOT EXISTS idx_user_articles_read ON user_articles(user_id, is_read) WHERE is_read = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_articles_bookmarked ON user_articles(user_id, is_bookmarked) WHERE is_bookmarked = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_articles_read_later ON user_articles(user_id, is_read_later) WHERE is_read_later = TRUE;

-- ============================================
-- RLS (Row Level Security)
-- ============================================

-- Enable RLS on new tables
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE fetch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_articles ENABLE ROW LEVEL SECURITY;

-- RLS policies for articles
-- Users can view articles from their own feeds
CREATE POLICY "Users can view articles from their feeds" ON articles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM feeds
      WHERE feeds.id = articles.feed_id
      AND feeds.user_id = auth.uid()
    )
  );

-- RLS policies for fetch_status
-- Users can view fetch status for their own feeds
CREATE POLICY "Users can view fetch status for their feeds" ON fetch_status
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM feeds
      WHERE feeds.id = fetch_status.feed_id
      AND feeds.user_id = auth.uid()
    )
  );

-- RLS policies for fetch_history
-- Users can view fetch history for their own feeds
CREATE POLICY "Users can view fetch history for their feeds" ON fetch_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM feeds
      WHERE feeds.id = fetch_history.feed_id
      AND feeds.user_id = auth.uid()
    )
  );

-- RLS policies for user_articles
CREATE POLICY "Users can manage their own article interactions" ON user_articles
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Triggers and Functions
-- ============================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_articles.updated_at
CREATE TRIGGER update_user_articles_updated_at
  BEFORE UPDATE ON user_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE articles IS 'Article content fetched from RSS feeds';
COMMENT ON TABLE fetch_status IS 'Fetch status and statistics cache for feeds';
COMMENT ON TABLE fetch_history IS 'Historical record of fetch operations';
COMMENT ON TABLE user_articles IS 'Unified table for user interactions with articles (read, bookmarked, read later)';
