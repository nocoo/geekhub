import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Rss, CheckCheck, Eye, EyeOff, RefreshCw, Languages } from 'lucide-react';
import { Article } from '@/hooks/useDatabase';
import { useMarkAllAsRead, useMarkAsRead, useToggleAutoTranslate, useFetchFeed, useIsFeedFetching } from '@/hooks/useFeedActions';
import { useAuth } from '@/contexts/AuthContext';
import { useFeedViewModel } from '@/hooks/useFeedViewModels';
import { cn } from '@/lib/utils';
import { useFormatTime } from '@/lib/format-time';
import { useSettings } from '@/lib/settings';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { getProxyImageUrl, getRefererFromUrl } from '@/lib/image-proxy';
import { getTranslationFromCache } from '@/lib/translation-cache';
import { getTranslationQueue } from '@/lib/translation-queue';

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
  const toggleAutoTranslate = useToggleAutoTranslate();
  const fetchFeed = useFetchFeed();
  const isFeedFetching = useIsFeedFetching(feedId);
  const [showRead, setShowRead] = useState(false);
  const [, forceUpdate] = useState({});

  // Get current feed's ViewModel for unread count and auto_translate
  const feedViewModel = useFeedViewModel(feedId);
  const unreadCountFromViewModel = feedViewModel?.unreadCount ?? 0;
  const autoTranslate = feedViewModel?.autoTranslate ?? false;
  const effectiveAutoTranslate = autoTranslate;

  // Apply cached translations to articles to prevent flash on initial render
  const articlesWithCachedTranslations = useMemo(() => {
    if (!effectiveAutoTranslate) return articles;

    return articles.map(article => {
      const cached = getTranslationFromCache(article.id);
      if (cached) {
        return {
          ...article,
          translatedTitle: cached.translatedTitle,
          translatedDescription: cached.translatedDescription,
        };
      }
      return article;
    });
  }, [articles, autoTranslate]);

  // Track articles read in current feed session (cleared when switching feeds)
  const sessionReadIdsRef = useRef<Set<string>>(new Set());

  // Ref for the article list container and selected article
  const listContainerRef = useRef<HTMLDivElement>(null);
  const selectedArticleRef = useRef<HTMLButtonElement>(null);
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);
  const visibleArticlesRef = useRef<Set<string>>(new Set());
  const translateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear session read IDs when feed changes
  useEffect(() => {
    sessionReadIdsRef.current.clear();
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
    return article.isRead || (article.id && sessionReadIdsRef.current.has(article.id));
  }, [forceUpdate]); // Add forceUpdate as dependency to trigger re-render

  // Filter articles: show if unread OR was just read in this session
  const filteredArticles = useMemo(() => {
    if (showRead) {
      // Show all articles
      return articlesWithCachedTranslations;
    }

    // For special feeds (starred, later), always show all articles
    if (feedId === 'starred' || feedId === 'later') {
      return articlesWithCachedTranslations;
    }

    // Show articles that are unread OR were read in this session
    return articlesWithCachedTranslations.filter(a => !a.isRead || (a.id && sessionReadIdsRef.current.has(a.id)));
  }, [articlesWithCachedTranslations, showRead, feedId]);

  // Handle article selection - mark as read and track in session
  const handleSelectArticle = useCallback((article: Article) => {
    if (!article.isRead && article.id && feedId) {
      // Add to session read IDs to keep it visible
      sessionReadIdsRef.current.add(article.id);
      // Mark as read in database
      markAsRead.mutate({ articleId: article.id, feedId });
    }
    onSelectArticle(article);
  }, [feedId, markAsRead, onSelectArticle]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    if (!feedId || isFeedFetching) return;

    // Get current feed title for toast from ViewModel
    const feedTitle = feedViewModel?.title;

    fetchFeed.mutate({ feedId, feedTitle });
  }, [feedId, isFeedFetching, feedViewModel, fetchFeed]);

  // Setup Intersection Observer for visible articles
  useEffect(() => {
    // Only setup for feeds with auto_translate enabled
    if (!autoTranslate || !feedId || feedId === 'starred' || feedId === 'later') {
      // Clean up observer if auto_translate is disabled
      if (intersectionObserverRef.current) {
        intersectionObserverRef.current.disconnect();
        intersectionObserverRef.current = null;
      }
      if (translateTimeoutRef.current) {
        clearTimeout(translateTimeoutRef.current);
        translateTimeoutRef.current = null;
      }
      visibleArticlesRef.current.clear();
      return;
    }

    // Create Intersection Observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const articleId = entry.target.getAttribute('data-article-id');
          if (!articleId) return;

          if (entry.isIntersecting) {
            visibleArticlesRef.current.add(articleId);
          } else {
            visibleArticlesRef.current.delete(articleId);
          }
        });

        // Debounce: wait for scrolling to stop before translating
        if (translateTimeoutRef.current) {
          clearTimeout(translateTimeoutRef.current);
        }

        translateTimeoutRef.current = setTimeout(() => {
          if (visibleArticlesRef.current.size > 0) {
            const queue = getTranslationQueue(10);

            filteredArticles.forEach((article) => {
              // Skip if already in queue
              if (queue.isInQueue(article.id)) {
                return;
              }

              // Skip if already has cached translation (to avoid flash)
              if (getTranslationFromCache(article.id)) {
                return;
              }

              // Only translate articles currently visible
              if (visibleArticlesRef.current.has(article.id)) {
                queue.translate({
                  article,
                  feedId,
                  userId: user?.id,
                  queryClient,
                  aiSettings: settings.ai,
                });
              }
            });
          }
        }, 300); // Wait 300ms after scrolling stops
      },
      {
        root: listContainerRef.current,
        rootMargin: '0px',
        threshold: 0.1,
      }
    );

    intersectionObserverRef.current = observer;

    // Observe all article elements
    const articleElements = listContainerRef.current?.querySelectorAll('[data-article-id]');
    articleElements?.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      intersectionObserverRef.current = null;
      if (translateTimeoutRef.current) {
        clearTimeout(translateTimeoutRef.current);
        translateTimeoutRef.current = null;
      }
    };
  }, [autoTranslate, feedId, filteredArticles, user?.id, queryClient, settings.ai]);

  // Re-observe when filteredArticles change
  useEffect(() => {
    if (!intersectionObserverRef.current || !effectiveAutoTranslate) {
      return;
    }

    const observer = intersectionObserverRef.current;

    // Disconnect old observations
    const articleElements = listContainerRef.current?.querySelectorAll('[data-article-id]');
    articleElements?.forEach((el) => observer.unobserve(el));

    // Re-observe
    articleElements?.forEach((el) => observer.observe(el));
  }, [filteredArticles.length, effectiveAutoTranslate]);

  // Unread count: primary from ViewModel, fallback to local calculation
  const unreadCount = useMemo(() => {
    if (unreadCountFromViewModel > 0) {
      return unreadCountFromViewModel;
    }
    // Fallback: count from local articles
    return articles.filter(a => !isArticleRead(a)).length;
  }, [articles, isArticleRead, unreadCountFromViewModel]);

  const hasUnread = unreadCount > 0;

  const handleMarkAllAsRead = () => {
    if (feedId && hasUnread) {
      // Get all unread articles
      const unreadArticles = articles.filter(a => !a.isRead && a.id);

      // Optimistically add to session read IDs for immediate UI update
      unreadArticles.forEach(article => {
        if (article.id) {
          sessionReadIdsRef.current.add(article.id);
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

  // Handle translation toggle
  const handleTranslate = useCallback(() => {
    if (!feedId || feedId === 'starred' || feedId === 'later') {
      // Show error toast for special feeds
      import('sonner').then(({ toast }) => {
        toast.error('特殊订阅源不支持自动翻译');
      });
      return;
    }

    const newAutoTranslate = !autoTranslate;
    toggleAutoTranslate.mutate({ feedId, enabled: newAutoTranslate });
  }, [feedId, autoTranslate, toggleAutoTranslate]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if typing in an input/textarea
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

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
            {feedViewModel?.totalArticles ?? filteredArticles.length} 篇文章{hasUnread && <span className="text-muted-foreground ml-1">({unreadCountFromViewModel} 未读)</span>}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleTranslate}
              disabled={filteredArticles.length === 0}
              className={cn(
                "h-7 w-7",
                autoTranslate && "bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400"
              )}
              title={autoTranslate ? "已开启自动翻译" : "翻译文章"}
            >
              <Languages className="w-3.5 h-3.5" />
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
              disabled={!feedId || isFeedFetching}
              className="h-7 w-7"
              title="刷新文章"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFeedFetching ? 'animate-spin' : ''}`} />
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
            data-article-id={article.id}
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
                    {article.translatedTitle || article.title}
                  </h3>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5">
                  {article.translatedDescription || article.description}
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
          <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
            <div className="text-center text-muted-foreground">
              <p className="text-sm">没有找到文章</p>
              <p className="text-xs mt-1">{showRead ? '该订阅源暂无已读文章' : '该订阅源暂无未读文章'}</p>
              {feedId && (
                <Button
                  onClick={handleRefresh}
                  disabled={isFeedFetching}
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isFeedFetching ? 'animate-spin' : ''}`} />
                  {isFeedFetching ? '正在抓取...' : '立即抓取'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
