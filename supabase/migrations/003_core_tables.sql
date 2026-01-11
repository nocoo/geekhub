-- GeekHub 核心表结构 - 简化版本
-- 执行顺序：先删除旧的 migration，然后执行这个

-- 删除之前的表（如果存在）
DROP TABLE IF EXISTS articles CASCADE;
DROP TABLE IF EXISTS feeds CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 用户分类表
CREATE TABLE categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#10b981',
  icon VARCHAR(50) DEFAULT '📁',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_user_category_name UNIQUE(user_id, name)
);

-- RSS 源表
CREATE TABLE feeds (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,

  title VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  favicon_url TEXT,
  site_url TEXT,

  -- 文件存储 hash
  url_hash VARCHAR(12) NOT NULL,

  -- 抓取状态
  last_fetched_at TIMESTAMP WITH TIME ZONE,
  last_success_at TIMESTAMP WITH TIME ZONE,
  fetch_interval_minutes INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT TRUE,
  fetch_error TEXT,

  -- 统计
  total_articles INTEGER DEFAULT 0,
  unread_count INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_user_feed_url UNIQUE(user_id, url),
  CONSTRAINT unique_url_hash UNIQUE(url_hash)
);

-- 用户阅读状态表
CREATE TABLE read_articles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  feed_id UUID REFERENCES feeds(id) ON DELETE CASCADE NOT NULL,
  article_hash VARCHAR(32) NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_user_article_read UNIQUE(user_id, article_hash)
);

-- 用户收藏表
CREATE TABLE bookmarked_articles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  feed_id UUID REFERENCES feeds(id) ON DELETE CASCADE NOT NULL,
  article_hash VARCHAR(32) NOT NULL,
  article_title TEXT NOT NULL,
  article_url TEXT NOT NULL,
  bookmarked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,

  CONSTRAINT unique_user_article_bookmark UNIQUE(user_id, article_hash)
);

-- 创建索引
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_feeds_user_id ON feeds(user_id);
CREATE INDEX idx_feeds_url_hash ON feeds(url_hash);
CREATE INDEX idx_read_articles_user_feed ON read_articles(user_id, feed_id);
CREATE INDEX idx_bookmarked_articles_user ON bookmarked_articles(user_id);

-- 启用 RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE read_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarked_articles ENABLE ROW LEVEL SECURITY;

-- RLS 策略
CREATE POLICY "Users manage own categories" ON categories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own feeds" ON feeds FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own read status" ON read_articles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own bookmarks" ON bookmarked_articles FOR ALL USING (auth.uid() = user_id);

-- 自动更新时间戳
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_feeds_updated_at BEFORE UPDATE ON feeds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 生成 URL hash
CREATE OR REPLACE FUNCTION generate_url_hash(feed_url TEXT)
RETURNS VARCHAR(12) AS $$
BEGIN
  RETURN LEFT(MD5(feed_url), 12);
END;
$$ LANGUAGE plpgsql;

-- 自动设置 url_hash
CREATE OR REPLACE FUNCTION set_feed_url_hash()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.url_hash IS NULL OR NEW.url_hash = '' THEN
    NEW.url_hash = generate_url_hash(NEW.url);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_feed_url_hash_trigger BEFORE INSERT OR UPDATE ON feeds FOR EACH ROW EXECUTE FUNCTION set_feed_url_hash();

-- 为新用户创建默认分类
CREATE OR REPLACE FUNCTION create_default_categories_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO categories (user_id, name, color, icon, sort_order) VALUES
    (NEW.id, 'Technology', '#3b82f6', '💻', 1),
    (NEW.id, 'News', '#ef4444', '📰', 2),
    (NEW.id, 'Development', '#10b981', '🚀', 3),
    (NEW.id, 'General', '#6b7280', '📁', 4);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_default_categories_trigger AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION create_default_categories_for_user();