-- Migration 010: Add fetch_logs table for structured logging
-- Replace file-based logging with database logging

-- ============================================
-- Create fetch_logs table
-- ============================================
CREATE TABLE IF NOT EXISTS fetch_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feed_id         UUID REFERENCES feeds(id) ON DELETE CASCADE,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level           TEXT NOT NULL,
  status          INTEGER,
  action          TEXT NOT NULL,
  url             TEXT NOT NULL,
  duration_ms     INTEGER,
  message         TEXT
);

-- ============================================
-- Indexes for common queries
-- ============================================
CREATE INDEX IF NOT EXISTS idx_fetch_logs_feed_id ON fetch_logs(feed_id);
CREATE INDEX IF NOT EXISTS idx_fetch_logs_fetched_at ON fetch_logs(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_fetch_logs_level ON fetch_logs(level);
CREATE INDEX IF NOT EXISTS idx_fetch_logs_action ON fetch_logs(action);

-- ============================================
-- RLS policies
-- ============================================
ALTER TABLE fetch_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view fetch logs for their feeds" ON fetch_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM feeds
      WHERE feeds.id = fetch_logs.feed_id
      AND feeds.user_id = auth.uid()
    )
  );

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE fetch_logs IS 'Structured fetch logs replacing file-based logging';
