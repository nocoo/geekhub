-- 稍后阅读表
-- 类似 bookmarked_articles，但用于稍后阅读功能

CREATE TABLE read_later_articles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  feed_id UUID REFERENCES feeds(id) ON DELETE CASCADE NOT NULL,
  article_hash VARCHAR(32) NOT NULL,
  article_title TEXT NOT NULL,
  article_url TEXT NOT NULL,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,

  CONSTRAINT unique_user_article_read_later UNIQUE(user_id, article_hash)
);

-- 创建索引
CREATE INDEX idx_read_later_articles_user ON read_later_articles(user_id);

-- 启用 RLS
ALTER TABLE read_later_articles ENABLE ROW LEVEL SECURITY;

-- RLS 策略
CREATE POLICY "Users manage own read later articles" ON read_later_articles FOR ALL USING (auth.uid() = user_id);
