-- GeekHub RSS Reader Database Schema
-- 只存储 RSS 源和分类信息，文章内容存储在本地 JSON 文件中

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 用户分类表
CREATE TABLE categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#10b981', -- hex color code
  icon VARCHAR(50) DEFAULT '📁', -- emoji or icon name
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 确保用户的分类名称唯一
  CONSTRAINT unique_user_category_name UNIQUE(user_id, name)
);

-- RSS 源表
CREATE TABLE feeds (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,

  -- RSS 基本信息
  title VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  favicon_url TEXT,
  site_url TEXT, -- 网站主页 URL

  -- 文件存储相关
  url_hash VARCHAR(12) NOT NULL, -- URL 的 MD5 前12位，用于文件夹命名

  -- 抓取状态
  last_fetched_at TIMESTAMP WITH TIME ZONE,
  last_success_at TIMESTAMP WITH TIME ZONE,
  fetch_interval_minutes INTEGER DEFAULT 60, -- 抓取间隔（分钟）
  is_active BOOLEAN DEFAULT TRUE,
  fetch_error TEXT, -- 最后一次抓取错误信息

  -- 统计信息
  total_articles INTEGER DEFAULT 0,
  unread_count INTEGER DEFAULT 0,

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 确保用户的 RSS URL 唯一
  CONSTRAINT unique_user_feed_url UNIQUE(user_id, url),
  -- 确保 hash 在全局唯一（用于文件夹命名）
  CONSTRAINT unique_url_hash UNIQUE(url_hash)
);

-- 用户阅读状态表（记录已读文章的 hash）
CREATE TABLE read_articles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  feed_id UUID REFERENCES feeds(id) ON DELETE CASCADE NOT NULL,
  article_hash VARCHAR(32) NOT NULL, -- 文章内容的 MD5 hash
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 确保同一用户对同一文章只能标记一次已读
  CONSTRAINT unique_user_article_read UNIQUE(user_id, article_hash)
);

-- 用户收藏文章表
CREATE TABLE bookmarked_articles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  feed_id UUID REFERENCES feeds(id) ON DELETE CASCADE NOT NULL,
  article_hash VARCHAR(32) NOT NULL,
  article_title TEXT NOT NULL, -- 冗余存储标题，便于快速显示
  article_url TEXT NOT NULL,
  bookmarked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT, -- 用户笔记

  -- 确保同一用户对同一文章只能收藏一次
  CONSTRAINT unique_user_article_bookmark UNIQUE(user_id, article_hash)
);

-- 抓取任务队列表（可选，用于后台任务调度）
CREATE TABLE fetch_queue (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  feed_id UUID REFERENCES feeds(id) ON DELETE CASCADE NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引优化查询性能
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_sort_order ON categories(user_id, sort_order);

CREATE INDEX idx_feeds_user_id ON feeds(user_id);
CREATE INDEX idx_feeds_category_id ON feeds(category_id);
CREATE INDEX idx_feeds_url_hash ON feeds(url_hash);
CREATE INDEX idx_feeds_active ON feeds(is_active);
CREATE INDEX idx_feeds_last_fetched ON feeds(last_fetched_at);
CREATE INDEX idx_feeds_fetch_interval ON feeds(fetch_interval_minutes);

CREATE INDEX idx_read_articles_user_id ON read_articles(user_id);
CREATE INDEX idx_read_articles_feed_id ON read_articles(feed_id);
CREATE INDEX idx_read_articles_hash ON read_articles(article_hash);

CREATE INDEX idx_bookmarked_articles_user_id ON bookmarked_articles(user_id);
CREATE INDEX idx_bookmarked_articles_feed_id ON bookmarked_articles(feed_id);

CREATE INDEX idx_fetch_queue_status ON fetch_queue(status);
CREATE INDEX idx_fetch_queue_scheduled ON fetch_queue(scheduled_at);

-- 启用行级安全 (RLS)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE read_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarked_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fetch_queue ENABLE ROW LEVEL SECURITY;

-- Categories RLS 策略
CREATE POLICY "Users can manage their own categories" ON categories
  FOR ALL USING (auth.uid() = user_id);

-- Feeds RLS 策略
CREATE POLICY "Users can manage their own feeds" ON feeds
  FOR ALL USING (auth.uid() = user_id);

-- Read articles RLS 策略
CREATE POLICY "Users can manage their own read status" ON read_articles
  FOR ALL USING (auth.uid() = user_id);

-- Bookmarked articles RLS 策略
CREATE POLICY "Users can manage their own bookmarks" ON bookmarked_articles
  FOR ALL USING (auth.uid() = user_id);

-- Fetch queue RLS 策略（只允许查看自己 feeds 的任务）
CREATE POLICY "Users can view their own feed tasks" ON fetch_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM feeds
      WHERE feeds.id = fetch_queue.feed_id
      AND feeds.user_id = auth.uid()
    )
  );

-- 自动更新 updated_at 字段的函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feeds_updated_at
  BEFORE UPDATE ON feeds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fetch_queue_updated_at
  BEFORE UPDATE ON fetch_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 生成 URL hash 的函数
CREATE OR REPLACE FUNCTION generate_url_hash(feed_url TEXT)
RETURNS VARCHAR(12) AS $$
BEGIN
  RETURN LEFT(MD5(feed_url), 12);
END;
$$ LANGUAGE plpgsql;

-- 自动生成 url_hash 的触发器
CREATE OR REPLACE FUNCTION set_feed_url_hash()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.url_hash IS NULL OR NEW.url_hash = '' THEN
    NEW.url_hash = generate_url_hash(NEW.url);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_feed_url_hash_trigger
  BEFORE INSERT OR UPDATE ON feeds
  FOR EACH ROW EXECUTE FUNCTION set_feed_url_hash();

-- 为新用户创建默认分类的函数
CREATE OR REPLACE FUNCTION create_default_categories_for_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 创建默认分类
  INSERT INTO categories (user_id, name, color, icon, sort_order) VALUES
    (NEW.id, 'Technology', '#3b82f6', '💻', 1),
    (NEW.id, 'News', '#ef4444', '📰', 2),
    (NEW.id, 'Development', '#10b981', '🚀', 3),
    (NEW.id, 'General', '#6b7280', '📁', 4);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为新用户自动创建默认分类的触发器
CREATE TRIGGER create_default_categories_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_default_categories_for_user();

-- 示例查询和使用说明
/*
-- 1. 添加新的 RSS 源
INSERT INTO feeds (user_id, category_id, title, url, description)
VALUES (
  'user-uuid-here',
  'category-uuid-here',
  'Hacker News',
  'https://hnrss.org/newest?points=100',
  'Latest Hacker News stories with 100+ points'
);

-- 2. 查询用户的所有 RSS 源及分类信息
SELECT
  f.*,
  c.name as category_name,
  c.color as category_color,
  c.icon as category_icon
FROM feeds f
LEFT JOIN categories c ON f.category_id = c.id
WHERE f.user_id = 'user-uuid-here'
ORDER BY c.sort_order, f.title;

-- 3. 标记文章为已读
INSERT INTO read_articles (user_id, feed_id, article_hash)
VALUES ('user-uuid', 'feed-uuid', 'article-md5-hash')
ON CONFLICT (user_id, article_hash) DO NOTHING;

-- 4. 收藏文章
INSERT INTO bookmarked_articles (user_id, feed_id, article_hash, article_title, article_url)
VALUES (
  'user-uuid',
  'feed-uuid',
  'article-md5-hash',
  'Article Title',
  'https://example.com/article'
);

-- 5. 更新 RSS 源的统计信息
UPDATE feeds
SET
  total_articles = 150,
  unread_count = 25,
  last_fetched_at = NOW(),
  last_success_at = NOW()
WHERE id = 'feed-uuid';
*/