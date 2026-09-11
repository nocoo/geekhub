PRAGMA foreign_keys = ON;

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 60),
  color TEXT NOT NULL DEFAULT 'green',
  icon TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE feeds (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  site_url TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  auto_translate INTEGER NOT NULL DEFAULT 0 CHECK (auto_translate IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  refresh_minutes INTEGER NOT NULL DEFAULT 60 CHECK (refresh_minutes BETWEEN 15 AND 1440),
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'queued', 'fetching', 'success', 'error')),
  last_fetched_at TEXT,
  next_fetch_at TEXT,
  last_error TEXT,
  lease_until TEXT,
  etag TEXT,
  last_modified TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX feeds_category ON feeds(category_id);
CREATE INDEX feeds_due ON feeds(next_fetch_at, lease_until);

CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  feed_id TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  published_at TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  is_starred INTEGER NOT NULL DEFAULT 0 CHECK (is_starred IN (0, 1)),
  is_later INTEGER NOT NULL DEFAULT 0 CHECK (is_later IN (0, 1)),
  summary TEXT,
  translated_title TEXT,
  translated_description TEXT,
  translated_content TEXT,
  ai_model TEXT,
  full_content_fetched INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(feed_id, source_id)
);
CREATE INDEX articles_feed_date ON articles(feed_id, published_at DESC, id DESC);
CREATE INDEX articles_unread ON articles(feed_id, is_read, published_at DESC);

CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  preferences TEXT NOT NULL DEFAULT '{}',
  ai_config TEXT NOT NULL DEFAULT '{}',
  ai_key TEXT
);
INSERT INTO settings (id) VALUES (1);

CREATE TABLE fetch_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feed_id TEXT REFERENCES feeds(id) ON DELETE SET NULL,
  feed_title TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('info', 'success', 'error')),
  message TEXT NOT NULL,
  articles_added INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX logs_feed_date ON fetch_logs(feed_id, id DESC);

CREATE TABLE directory (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  site_url TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  source_feed_url TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags)),
  score TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(score)),
  last_updated TEXT,
  created_at TEXT,
  updated_at TEXT
);
INSERT INTO directory (id, title, url, site_url, description, category) VALUES
('cloudflare', 'Cloudflare Blog', 'https://blog.cloudflare.com/rss/', 'https://blog.cloudflare.com', '互联网背后的技术，从边缘计算到网络安全。', '技术与工程'),
('css-tricks', 'CSS-Tricks', 'https://css-tricks.com/feed/', 'https://css-tricks.com', 'CSS、界面细节和创造网页的乐趣。', '设计与体验'),
('fowler', 'Martin Fowler', 'https://martinfowler.com/feed.atom', 'https://martinfowler.com', '软件架构、重构与工程实践的长文。', '技术与工程'),
('hn', 'Hacker News', 'https://hnrss.org/frontpage', 'https://news.ycombinator.com', '保持好奇，发现技术社区正在讨论的话题。', '独立与创造'),
('simon', 'Simon Willison', 'https://simonwillison.net/atom/everything/', 'https://simonwillison.net', 'AI、数据工具与开源开发的每日笔记。', '技术与工程');
