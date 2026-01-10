import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Rss, CheckCheck, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Article, useMarkAllAsRead, useMarkAsRead } from '@/hooks/useDatabase';
import { useAuth } from '@/contexts/AuthContext';
import { useFeedFetchEvents } from '@/contexts/SSEContext';
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
  const markAsRead = useMarkAsRead();
  const [showRead, setShowRead] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Track articles read in current feed session (cleared when switching feeds)
  const sessionReadHashesRef = useRef<Set<string>>(new Set());

  // Clear session read hashes when feed changes
  useEffect(() => {
    sessionReadHashesRef.current.clear();
  }, [feedId]);

  // Filter articles: show if unread OR was just read in this session
  const filteredArticles = useMemo(() => {
    if (showRead) {
      // Show all articles
      return articles;
    }

    // Show articles that are unread OR were read in this session
    return articles.filter(a => !a.isRead || (a.hash && sessionReadHashesRef.current.has(a.hash)));
  }, [articles, showRead]);

  // Handle article selection - mark as read and track in session
  const handleSelectArticle = useCallback((article: Article) => {
    if (!article.isRead && article.hash && feedId) {
      // Add to session read hashes to keep it visible
      sessionReadHashesRef.current.add(article.hash);
      // Mark as read in database
      markAsRead.mutate({ articleHash: article.hash, feedId });
    }
    onSelectArticle(article);
  }, [feedId, markAsRead, onSelectArticle]);

  // Handle refresh
  const handleRefresh = async () => {
    if (!feedId || fetching) return;

    setFetching(true);
    try {
      const response = await fetch(`/api/feeds/${feedId}/fetch`, { method: 'POST' });
      if (response.ok) {
        toast.success('正在抓取最新文章...');
        // Fetching state will be reset when fetch-complete event is received
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

  // Listen for feed fetch completion events
  useFeedFetchEvents({
    onFetchComplete: useCallback((event: { feedId: string }) => {
      // Only handle events for the current feed
      if (event.feedId === feedId) {
        setFetching(false);
        // Refresh articles and feeds
        queryClient.invalidateQueries({ queryKey: ['articles', user?.id, feedId] });
        queryClient.invalidateQueries({ queryKey: ['feeds', user?.id] });
        toast.success('抓取完成');
      }
    }, [feedId, queryClient, user?.id]),
  });

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
      handleSelectArticle(filteredArticles[nextIndex]);
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredArticles.length - 1;
      handleSelectArticle(filteredArticles[prevIndex]);
    }
  }, [filteredArticles, selectedArticle, handleSelectArticle]);

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
          {feedId && (
            <Button
              onClick={handleRefresh}
              disabled={fetching}
              variant="outline"
              size="sm"
              className="mt-4 gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
              {fetching ? '正在抓取...' : '立即抓取'}
            </Button>
          )}
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
            onClick={() => handleSelectArticle(article)}
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
                    referrerPolicy="no-referrer"
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
