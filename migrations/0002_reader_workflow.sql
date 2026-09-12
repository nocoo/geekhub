ALTER TABLE feeds ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE feeds ADD COLUMN refresh_token TEXT;
ALTER TABLE feeds ADD COLUMN fetch_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE feeds ADD COLUMN failure_count INTEGER NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY title COLLATE NOCASE, id) - 1 AS position FROM feeds
)
UPDATE feeds SET sort_order = (SELECT position FROM ordered WHERE ordered.id = feeds.id);

CREATE TABLE feed_diagnostics (
  feed_id TEXT PRIMARY KEY REFERENCES feeds(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  feed_url TEXT NOT NULL,
  site_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'success', 'error')),
  requested_at TEXT NOT NULL,
  finished_at TEXT,
  error TEXT,
  report TEXT CHECK (report IS NULL OR json_valid(report))
);
