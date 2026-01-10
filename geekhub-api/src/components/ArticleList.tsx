import { useEffect, useCallback, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Rss, CheckCheck, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Article, useMarkAllAsRead } from '@/hooks/useDatabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useFormatTime } from '@/lib/format-time';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';

interface ArticleListProps {
  articles: Article[];
  selectedArticle: Article | null;
  onSelectArticle: (article: Article) => void;
  isLoading?: boolean;
  feedId: string | null;
}

export function ArticleList({ articles, selectedArticle, onSelectArticle, isLoading, feedId }: ArticleListProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const formatTime = useFormatTime();
  const markAllAsRead = useMarkAllAsRead();
  const [showRead, setShowRead] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Filter articles in memory based on showRead setting
  const filteredArticles = useMemo(() => {
    const unreadArticles = articles.filter(a => !a.isRead);

    if (showRead) {
      // Show all articles
      return articles;
    } else if (unreadArticles.length === 0 && articles.length > 0) {
      // No unread articles but have articles, show all instead of empty list
      return articles;
    } else {
      // Show only unread articles
      return unreadArticles;
    }
  }, [articles, showRead]);

  // Handle refresh
  const handleRefresh = async () => {
    if (!feedId || fetching) return;

    setFetching(true);
    try {
      const response = await fetch(`/api/feeds/${feedId}/fetch`, { method: 'POST' });
      if (response.ok) {
        toast.success('正在抓取最新文章...');

        // Wait for fetch to complete, then refetch
        setTimeout(async () => {
          // Refetch articles and feeds
          await queryClient.invalidateQueries({ queryKey: ['articles', user?.id, feedId] });
          await queryClient.invalidateQueries({ queryKey: ['feeds', user?.id] });
          setFetching(false);
          toast.success('抓取完成');
        }, 3000);
      } else {
        const { error } = await response.json();
        toast.error(error || '抓取失败');
        setFetching(false);
      }
    } catch (error) {
      console.error('Failed to fetch feed:', error);
      toast.error('抓取失败');
      setFetching(false);
    }
  };

  // Count unread from current articles
  const unreadCount = useMemo(() =>
    articles.filter(a => !a.isRead).length,
    [articles]
  );
  const hasUnread = unreadCount > 0;

  const handleMarkAllAsRead = () => {
    if (feedId && hasUnread) {
      markAllAsRead.mutate(feedId);
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!filteredArticles.length) return;

    const currentIndex = selectedArticle
      ? filteredArticles.findIndex(a => a.id === selectedArticle.id)
      : -1;

    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      const nextIndex = currentIndex < filteredArticles.length - 1 ? currentIndex + 1 : 0;
      onSelectArticle(filteredArticles[nextIndex]);
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredArticles.length - 1;
      onSelectArticle(filteredArticles[prevIndex]);
    }
  }, [filteredArticles, selectedArticle, onSelectArticle]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (isLoading) {
    return (
      <div className="w-96 flex-shrink-0 border-r border-subtle h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (filteredArticles.length === 0) {
    return (
      <div className="w-96 flex-shrink-0 border-r border-subtle h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">没有找到文章</p>
          <p className="text-xs mt-1">{showRead ? '该订阅源暂无文章' : '选择一个订阅源开始阅读'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 flex-shrink-0 border-r border-subtle h-[calc(100vh-3.5rem)] overflow-y-auto hover-scrollbar bg-card/50">
      <div className="p-3 border-b border-subtle sticky top-0 bg-card/95 backdrop-blur-sm z-10">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">
            {filteredArticles.length} 篇文章{hasUnread && <span className="text-muted-foreground ml-1">({unreadCount} 未读)</span>}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowRead(!showRead)}
              className="h-7 w-7"
              title={showRead ? '隐藏已读' : '显示已读'}
            >
              {showRead ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={!feedId || fetching}
              className="h-7 w-7"
              title="刷新文章"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${fetching ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleMarkAllAsRead}
              disabled={!feedId || !hasUnread || markAllAsRead.isPending}
              className="h-7 w-7"
              title="全部标记为已读"
            >
              <CheckCheck className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="divide-y divide-border/30">
        {filteredArticles.map(article => (
          <button
            key={article.id}
            onClick={() => onSelectArticle(article)}
            className={cn(
              "w-full text-left p-4 transition-all duration-150 relative group",
              selectedArticle?.id === article.id
                ? "bg-accent"
                : "hover:bg-accent/50",
              !article.isRead && "bg-primary/5"
            )}
          >
            {/* Selection indicator */}
            {selectedArticle?.id === article.id && (
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />
            )}

            <div className="flex gap-3">
              <div className="flex-1 min-w-0">
                {/* Unread indicator */}
                <div className="flex items-start gap-2">
                  {!article.isRead && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  )}
                  <h3 className={cn(
                    "text-sm leading-snug line-clamp-2",
                    !article.isRead ? "font-semibold text-foreground" : "font-medium text-foreground/90"
                  )}>
                    {article.title}
                  </h3>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5">
                  {article.description}
                </p>

                {/* Metadata */}
                <div className="flex items-center gap-2 mt-2">
                  <Rss className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  {article.author && (
                    <>
                      <span className="text-xs text-muted-foreground truncate">
                        {article.author}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                    </>
                  )}
                  {article.publishedAt && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatTime(article.publishedAt)}
                    </span>
                  )}
                </div>
              </div>

              {/* Article image */}
              {article.image && (
                <div className="w-20 h-20 flex-shrink-0 relative">
                  <img
                    src={article.image}
                    alt={article.title}
                    className="w-full h-full object-cover rounded-md"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
