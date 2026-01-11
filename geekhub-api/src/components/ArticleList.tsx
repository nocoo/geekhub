import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Rss, CheckCheck, Eye, EyeOff, RefreshCw, Languages } from 'lucide-react';
import { Article, useMarkAllAsRead, useMarkAsRead } from '@/hooks/useDatabase';
import { useAuth } from '@/contexts/AuthContext';
import { useFeedFetchEvents } from '@/contexts/SSEContext';
import { cn } from '@/lib/utils';
import { useFormatTime } from '@/lib/format-time';
import { useSettings } from '@/lib/settings';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { fetchFeedWithSettings } from '@/lib/fetch-with-settings';
import { getProxyImageUrl, getRefererFromUrl } from '@/lib/image-proxy';

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
  const { settings } = useSettings();
  const markAllAsRead = useMarkAllAsRead();
  const markAsRead = useMarkAsRead();
  const [showRead, setShowRead] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [, forceUpdate] = useState({});

  // Track articles read in current feed session (cleared when switching feeds)
  const sessionReadHashesRef = useRef<Set<string>>(new Set());

  // Ref for the article list container and selected article
  const listContainerRef = useRef<HTMLDivElement>(null);
  const selectedArticleRef = useRef<HTMLButtonElement>(null);

  // Clear session read hashes when feed changes
  useEffect(() => {
    sessionReadHashesRef.current.clear();
  }, [feedId]);

  // Scroll selected article into view
  const scrollToSelectedArticle = useCallback(() => {
    if (selectedArticleRef.current && listContainerRef.current) {
      const container = listContainerRef.current;
      const element = selectedArticleRef.current;

      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      // Check if element is outside the visible area
      const isAbove = elementRect.top < containerRect.top;
      const isBelow = elementRect.bottom > containerRect.bottom;

      if (isAbove || isBelow) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }
    }
  }, []);

  // Auto-scroll when selected article changes via keyboard
  useEffect(() => {
    if (selectedArticle) {
      // Small delay to ensure the ref is updated
      setTimeout(scrollToSelectedArticle, 50);
    }
  }, [selectedArticle, scrollToSelectedArticle]);

  // Check if article should be displayed as read (including session read)
  const isArticleRead = useCallback((article: Article) => {
    return article.isRead || (article.hash && sessionReadHashesRef.current.has(article.hash));
  }, [forceUpdate]); // Add forceUpdate as dependency to trigger re-render

  // Filter articles: show if unread OR was just read in this session
  const filteredArticles = useMemo(() => {
    if (showRead) {
      // Show all articles
      return articles;
    }

    // For special feeds (starred, later), always show all articles
    if (feedId === 'starred' || feedId === 'later') {
      return articles;
    }

    // Show articles that are unread OR were read in this session
    return articles.filter(a => !a.isRead || (a.hash && sessionReadHashesRef.current.has(a.hash)));
  }, [articles, showRead, feedId]);

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
      const response = await fetchFeedWithSettings(feedId);
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

  // Count unread from current articles (excluding session read)
  const unreadCount = useMemo(() =>
    articles.filter(a => !isArticleRead(a)).length,
    [articles, isArticleRead]
  );
  const hasUnread = unreadCount > 0;

  const handleMarkAllAsRead = () => {
    if (feedId && hasUnread) {
      // Get all unread articles
      const unreadArticles = articles.filter(a => !a.isRead && a.hash);

      // Optimistically add to session read hashes for immediate UI update
      unreadArticles.forEach(article => {
        if (article.hash) {
          sessionReadHashesRef.current.add(article.hash);
        }
      });

      // Force re-render to update the UI immediately
      forceUpdate({});

      // Show toast notification
      toast.success(`已将 ${unreadArticles.length} 篇文章标记为已读`);

      // Call the real API in the background (fire and forget)
      markAllAsRead.mutate(feedId, {
        onError: (error) => {
          // Silently log error, don't show to user since it's fire-and-forget
          console.error('Background mark all as read failed:', error);
        }
      });
    }
  };

  // Handle translation
  const handleTranslate = async () => {
    if (!settings.ai.enabled) {
      toast.error('请先在设置中启用 AI 功能');
      return;
    }

    const articlesToTranslate = filteredArticles;
    if (articlesToTranslate.length === 0) {
      toast.error('没有可翻译的文章');
      return;
    }

    setTranslating(true);
    setShowTranslation(true);  // Enable translation display immediately

    // Only translate first batch (max 10 articles)
    const BATCH_SIZE = 10;
    const batch = articlesToTranslate.slice(0, BATCH_SIZE);

    let completedCount = 0;
    const totalCount = batch.length;

    try {
      toast.info('翻译中...');

      // Send concurrent requests, one per article
      batch.forEach((article) => {
        // Fire and forget - each request updates UI independently
        fetch('/api/ai/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            articles: [{
              id: article.id,
              title: article.title,
              description: article.description,
            }],
            aiSettings: settings.ai,
          }),
        })
          .then(async (response) => {
            if (!response.ok) {
              const { error } = await response.json();
              throw new Error(error || '翻译失败');
            }
            return response.json();
          })
          .then(({ translations }) => {
            // Update this specific article immediately with forced sync render
            flushSync(() => {
              queryClient.setQueryData<Article[]>(['articles', user?.id, feedId], (old = []) =>
                old.map(a => {
                  if (a.id === article.id) {
                    return {
                      ...a,
                      translatedTitle: translations[0].translatedTitle,
                      translatedDescription: translations[0].translatedDescription,
                    };
                  }
                  return a;
                })
              );
            });

            // Update progress
            completedCount++;
            if (completedCount === totalCount) {
              setTranslating(false);
              toast.success(`翻译完成！共翻译 ${totalCount} 篇文章`);
            }
          })
          .catch((error) => {
            console.error('Translation error for article:', article.id, error);
            completedCount++;
            if (completedCount === totalCount) {
              setTranslating(false);
            }
          });
      });
    } catch (error) {
      console.error('Translation error:', error);
      toast.error(error instanceof Error ? error.message : '翻译失败');
      setTranslating(false);
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

  return (
    <div
      ref={listContainerRef}
      className="w-96 flex-shrink-0 border-r border-subtle h-[calc(100vh-3.5rem)] overflow-y-auto hover-scrollbar bg-card/50"
    >
      <div className="p-3 border-b border-subtle sticky top-0 bg-card/95 backdrop-blur-sm z-10">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">
            {filteredArticles.length} 篇文章{hasUnread && <span className="text-muted-foreground ml-1">({unreadCount} 未读)</span>}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleTranslate}
              disabled={!settings.ai.enabled || translating || filteredArticles.length === 0}
              className="h-7 w-7"
              title={showTranslation ? "翻译完成" : "翻译文章"}
            >
              <Languages className={`w-3.5 h-3.5 ${translating ? 'animate-pulse' : ''}`} />
            </Button>
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
              disabled={!feedId || !hasUnread}
              className="h-7 w-7"
              title="标记全部已读"
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
            ref={selectedArticle?.id === article.id ? selectedArticleRef : null}
            onClick={() => handleSelectArticle(article)}
            className={cn(
              "w-full text-left p-4 transition-all duration-150 relative group",
              selectedArticle?.id === article.id
                ? "bg-accent"
                : "hover:bg-accent/50",
              !isArticleRead(article) && "bg-primary/5"
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
                  {!isArticleRead(article) && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  )}
                  <h3 className={cn(
                    "text-sm leading-snug line-clamp-2",
                    !isArticleRead(article) ? "font-semibold text-foreground" : "font-medium text-foreground/90"
                  )}>
                    {showTranslation && article.translatedTitle ? article.translatedTitle : article.title}
                  </h3>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5">
                  {showTranslation && article.translatedDescription ? article.translatedDescription : article.description}
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
                    src={getProxyImageUrl(article.image, article.url ? getRefererFromUrl(article.url) : undefined)}
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

        {/* Empty state */}
        {filteredArticles.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center text-muted-foreground">
              <p className="text-sm">没有找到文章</p>
              <p className="text-xs mt-1">{showRead ? '该订阅源暂无已读文章' : '该订阅源暂无未读文章'}</p>
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
        )}
      </div>
    </div>
  );
}
