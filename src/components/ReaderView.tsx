import parse from 'html-react-parser';
import { ExternalLink, Bookmark, Share2, Expand, Minimize2, Image, ImageOff, Bug, Clock, Sparkles, Languages } from 'lucide-react';
import { Article, useBookmarkArticle, useUnbookmarkArticle, useSaveForLater, useRemoveFromLater } from '@/hooks/useDatabase';
import { Button } from '@/components/ui/button';
import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from '@/components/ui/sonner';
import { getProxyImageUrl, getRefererFromUrl } from '@/lib/image-proxy';
import { useFormatTime } from '@/lib/format-time';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/lib/settings';
import { AISummaryDialog } from '@/components/AISummaryDialog';

const CONTENT_CACHE_KEY = 'geekhub_content_translations';
const CONTENT_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

function getContentTranslationCache(articleId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(CONTENT_CACHE_KEY);
    if (!cached) return null;
    const cache = JSON.parse(cached);
    const entry = cache[articleId];
    if (!entry) return null;
    // Check if expired
    if (Date.now() - entry.timestamp > CONTENT_CACHE_DURATION) {
      delete cache[articleId];
      localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(cache));
      return null;
    }
    return entry.translatedContent;
  } catch {
    return null;
  }
}

function saveContentTranslationCache(articleId: string, translatedContent: string): void {
  if (typeof window === 'undefined') return;
  try {
    const cached = localStorage.getItem(CONTENT_CACHE_KEY);
    const cache = cached ? JSON.parse(cached) : {};
    cache[articleId] = {
      translatedContent,
      timestamp: Date.now(),
    };
    localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('Failed to save content translation cache:', e);
  }
}

interface ReaderViewProps {
  article: Article | null;
}

// Generate a consistent color from a string
function stringToColor(str: string): string {
  const colors = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
    'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
    'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
    'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'
  ];

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

// Get first character from a string (handles both English and Chinese)
function getFirstChar(str: string): string {
  return str?.charAt(0)?.toUpperCase() || '?';
}

export function ReaderView({ article }: ReaderViewProps) {
  const formatTime = useFormatTime();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { settings } = useSettings();
  const [fullWidth, setFullWidth] = useState(false);
  const [showImages, setShowImages] = useState(true);
  const [enhancedContent, setEnhancedContent] = useState<string | null>(null);
  const [isLoadingFull, setIsLoadingFull] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isReadLater, setIsReadLater] = useState(false);
  const [showAISummary, setShowAISummary] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);

  // Ref for the scrollable container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const toggleWidth = useCallback(() => setFullWidth(prev => !prev), []);
  const toggleImages = useCallback(() => setShowImages(prev => !prev), []);

  const bookmarkArticle = useBookmarkArticle();
  const unbookmarkArticle = useUnbookmarkArticle();
  const saveForLater = useSaveForLater();
  const removeFromLater = useRemoveFromLater();

  // Update bookmark and read later status when article changes or cache updates
  useEffect(() => {
    if (!article?.hash || !user) {
      setIsBookmarked(false);
      setIsReadLater(false);
      return;
    }

    const updateStatus = () => {
      // Check if article is bookmarked by looking at starred articles cache
      const starredArticles = queryClient.getQueryData<Article[]>(['articles', user.id, 'starred']);
      const isCurrentlyBookmarked = starredArticles?.some(a => a.hash === article.hash) || false;
      setIsBookmarked(isCurrentlyBookmarked);

      // Check if article is in read later by looking at later articles cache
      const laterArticles = queryClient.getQueryData<Article[]>(['articles', user.id, 'later']);
      const isCurrentlyReadLater = laterArticles?.some(a => a.hash === article.hash) || false;
      setIsReadLater(isCurrentlyReadLater);
    };

    // Initial update
    updateStatus();

    // Subscribe to cache changes
    const unsubscribeStarred = queryClient.getQueryCache().subscribe((event) => {
      if (event.query.queryKey[0] === 'articles' &&
          event.query.queryKey[1] === user.id &&
          event.query.queryKey[2] === 'starred') {
        updateStatus();
      }
    });

    const unsubscribeLater = queryClient.getQueryCache().subscribe((event) => {
      if (event.query.queryKey[0] === 'articles' &&
          event.query.queryKey[1] === user.id &&
          event.query.queryKey[2] === 'later') {
        updateStatus();
      }
    });

    return () => {
      unsubscribeStarred();
      unsubscribeLater();
    };
  }, [article?.hash, user?.id, queryClient]);

  // Handle bookmark toggle
  const handleBookmark = useCallback(() => {
    if (!article) return;

    if (isBookmarked) {
      // Optimistically update UI
      setIsBookmarked(false);
      toast.success('已取消收藏');

      unbookmarkArticle.mutate(article.hash || '', {
        onError: (error) => {
          // Rollback on error
          setIsBookmarked(true);
          console.error('Failed to toggle bookmark:', error);
          toast.error('操作失败，已回滚');
        }
      });
    } else {
      // Optimistically update UI
      setIsBookmarked(true);
      toast.success('已收藏');

      bookmarkArticle.mutate({
        articleHash: article.hash || '',
        feedId: article.feedId,
        articleTitle: article.title,
        articleUrl: article.url,
      }, {
        onError: (error) => {
          // Rollback on error
          setIsBookmarked(false);
          console.error('Failed to toggle bookmark:', error);
          toast.error('操作失败，已回滚');
        }
      });
    }
  }, [article, isBookmarked, bookmarkArticle, unbookmarkArticle]);

  // Handle read later toggle
  const handleReadLater = useCallback(() => {
    if (!article) return;

    if (isReadLater) {
      // Optimistically update UI
      setIsReadLater(false);
      toast.success('已从稍后阅读移除');

      removeFromLater.mutate(article.hash || '', {
        onError: (error) => {
          // Rollback on error
          setIsReadLater(true);
          console.error('Failed to toggle read later:', error);
          toast.error('操作失败，已回滚');
        }
      });
    } else {
      // Optimistically update UI
      setIsReadLater(true);
      toast.success('已添加到稍后阅读');

      saveForLater.mutate({
        articleHash: article.hash || '',
        feedId: article.feedId,
        articleTitle: article.title,
        articleUrl: article.url,
      }, {
        onError: (error) => {
          // Rollback on error
          setIsReadLater(false);
          console.error('Failed to toggle read later:', error);
          toast.error('操作失败，已回滚');
        }
      });
    }
  }, [article, isReadLater, saveForLater, removeFromLater]);

  // Reset enhanced content when article changes
  useEffect(() => {
    setEnhancedContent(null);
    setShowTranslation(false);
    setTranslatedContent(null);
  }, [article?.id]);

  // Load cached translation when article changes
  useEffect(() => {
    if (!article?.id) return;
    const cached = getContentTranslationCache(article.id);
    if (cached) {
      setTranslatedContent(cached);
      setShowTranslation(true);
    }
  }, [article?.id]);

  // Auto-fetch content when article has no content or very short content
  useEffect(() => {
    if (!article?.url) return;

    // Check if we need to fetch full content
    const needsFetch = !article.content || article.content.length < 500;

    if (!needsFetch) return;

    // Auto-fetch full content
    const fetchContent = async () => {
      setIsLoadingFull(true);
      try {
        const response = await fetch(`/api/articles/${article.id}/fetch-full`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: article.url }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch full content');
        }

        const data = await response.json();
        if (data.success && data.content) {
          setEnhancedContent(data.content);
        }
      } catch (error) {
        console.error('[AutoFetch] Failed:', error);
      } finally {
        setIsLoadingFull(false);
      }
    };

    fetchContent();
  }, [article?.id, article?.url, article?.content, article?.title]);

  // Scroll to top when article changes
  useEffect(() => {
    if (article && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }, [article?.id]);

  // Use enhanced content if available, otherwise use original content
  // Show translated content if translation is active
  const displayContent = showTranslation && translatedContent
    ? translatedContent
    : (enhancedContent || article?.content);

  // Handle AI summary
  const handleAISummary = useCallback(() => {
    if (!article) return;

    // Check if AI is enabled
    if (!settings.ai.enabled) {
      toast.error('AI 功能未启用，请在设置中开启');
      return;
    }

    // Check if API key is configured
    if (!settings.ai.apiKey || settings.ai.apiKey.trim() === '') {
      toast.error('请先在设置中配置 AI API Key');
      return;
    }

    // Check if base URL is configured
    if (!settings.ai.baseUrl || settings.ai.baseUrl.trim() === '') {
      toast.error('请先在设置中配置 AI Base URL');
      return;
    }

    setShowAISummary(true);
  }, [article, settings.ai]);

  // Copy debug info to clipboard
  const handleDebug = useCallback(() => {
    if (!article) return;

    const debugInfo = {
      id: article.id,
      hash: article.hash,
      feedId: article.feedId,
      feedName: article.feedName,
      title: article.title,
      url: article.url,
      publishedAt: article.publishedAt,
      hasImage: !!article.image,
      image: article.image,
      contentLength: article.content?.length || 0,
      enhancedContentLength: enhancedContent?.length || 0,
      contentPreview: article.content?.slice(0, 200),
    };

    const debugString = JSON.stringify(debugInfo, null, 2);
    navigator.clipboard.writeText(debugString).then(() => {
      toast.success('调试信息已复制到剪贴板');
    }).catch(() => {
      toast.error('复制失败');
    });
  }, [article, enhancedContent]);

  // Handle content translation
  const handleTranslate = useCallback(async () => {
    if (!article?.id || !displayContent) {
      toast.error('文章内容为空，无法翻译');
      return;
    }

    if (!settings.ai.enabled) {
      toast.error('请先在设置中启用 AI 功能');
      return;
    }

    // Toggle translation if already translated
    if (showTranslation && translatedContent) {
      setShowTranslation(false);
      return;
    }

    // Check cache first
    const cached = getContentTranslationCache(article.id);
    if (cached) {
      setTranslatedContent(cached);
      setShowTranslation(true);
      toast.success('使用缓存的翻译');
      return;
    }

    // Fetch translation
    setIsTranslating(true);
    toast.info('翻译中，请稍候...');

    try {
      const response = await fetch('/api/ai/translate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: article.id,
          content: displayContent,
          aiSettings: settings.ai,
        }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || '翻译失败');
      }

      const { translatedContent: content } = await response.json();

      // Save to cache
      saveContentTranslationCache(article.id, content);

      setTranslatedContent(content);
      setShowTranslation(true);
      toast.success('翻译完成');
    } catch (error) {
      console.error('Translation error:', error);
      toast.error(error instanceof Error ? error.message : '翻译失败');
    } finally {
      setIsTranslating(false);
    }
  }, [article, displayContent, settings.ai, showTranslation, translatedContent]);

  if (!article) {
    return (
      <div className="flex-1 h-[calc(100vh-3.5rem)] flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
            <span className="text-3xl">📖</span>
          </div>
          <h2 className="text-lg font-medium text-foreground">选择一篇文章</h2>
          <p className="text-sm text-muted-foreground mt-1">
            从列表中选择一篇文章开始阅读
          </p>
          <div className="mt-4 text-xs text-muted-foreground font-mono">
            快捷提示：使用 <kbd className="px-1.5 py-0.5 bg-muted rounded">↑</kbd> <kbd className="px-1.5 py-0.5 bg-muted rounded">↓</kbd> 或 <kbd className="px-1.5 py-0.5 bg-muted rounded">j</kbd> <kbd className="px-1.5 py-0.5 bg-muted rounded">k</kbd> 导航
          </div>
        </div>
      </div>
    );
  }

  const avatarColor = stringToColor(article.feedName);
  const avatarChar = getFirstChar(article.feedName);

  // Process content to hide images if needed
  const processedContent = showImages
    ? displayContent
    : displayContent?.replace(/<img[^>]*>/gi, '');

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 h-[calc(100vh-3.5rem)] overflow-y-auto hover-scrollbar bg-background"
    >
      <article className={fullWidth ? "w-full px-6 py-8" : "max-w-3xl mx-auto px-6 py-8"}>
        {/* Article header */}
        <header className="mb-8">
          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold font-sans leading-tight text-foreground mb-4">
            {article.title}
          </h1>

          {/* Site info row with action buttons */}
          <div className="flex items-center justify-between mb-4 pb-6 border-b border-subtle">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className={`w-5 h-5 rounded-full ${avatarColor} flex items-center justify-center text-white font-medium text-[10px]`}>
                {avatarChar}
              </div>
              <span>{article.feedName}</span>
              <span>·</span>
              <span>
                {article.publishedAt ? formatTime(article.publishedAt) : '无日期'}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${showTranslation ? 'bg-green-500/10 text-green-600 dark:text-green-400' : ''}`}
                title={showTranslation ? '显示原文' : '翻译全文'}
                onClick={handleTranslate}
                disabled={isTranslating}
              >
                <Languages className={`w-4 h-4 ${isTranslating ? 'animate-pulse' : ''}`} />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="AI总结" onClick={handleAISummary}>
                <Sparkles className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Toggle width" onClick={toggleWidth}>
                {fullWidth ? <Minimize2 className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Toggle images" onClick={toggleImages}>
                {showImages ? <Image className="w-4 h-4" /> : <ImageOff className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Debug info" onClick={handleDebug}>
                <Bug className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${isBookmarked ? 'text-yellow-500' : ''}`}
                title={isBookmarked ? '取消收藏' : '收藏'}
                onClick={handleBookmark}
              >
                <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${isReadLater ? 'text-blue-500' : ''}`}
                title={isReadLater ? '从稍后阅读移除' : '稍后阅读'}
                onClick={handleReadLater}
              >
                <Clock className={`w-4 h-4 ${isReadLater ? 'fill-current' : ''}`} />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Share">
                <Share2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="View original"
                onClick={() => article.url && window.open(article.url, '_blank')}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* AI Summary (cached) */}
        {article.ai_summary && (
          <blockquote className="border-l-4 border-primary/50 pl-4 py-3 my-6 bg-muted/30 rounded-r-lg">
            <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
              <Sparkles className="w-4 h-4" />
              <span>AI 总结</span>
              <span className="text-xs">·</span>
              <span className="text-xs">
                {new Date(article.ai_summary.generated_at).toLocaleDateString()}
              </span>
            </div>
            <p className="text-base leading-relaxed m-0">
              {article.ai_summary.content}
            </p>
          </blockquote>
        )}

        {/* Content - Parse HTML */}
        <div className="prose prose-geek max-w-none font-serif text-lg leading-relaxed m-0">
          {isLoadingFull ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm text-muted-foreground">正在获取文章内容...</p>
              </div>
            </div>
          ) : processedContent ? parse(processedContent, {
            replace: (domNode: any) => {
              if (domNode.type === 'tag') {
                // Remove all inline styles to fix dark mode issues
                if (domNode.attribs?.style) {
                  delete domNode.attribs.style;
                }
                // Remove problematic attributes
                if (domNode.attribs?.bgcolor) {
                  delete domNode.attribs.bgcolor;
                }
                if (domNode.attribs?.background) {
                  delete domNode.attribs.background;
                }
                if (domNode.attribs?.color) {
                  delete domNode.attribs.color;
                }
                if (domNode.attribs?.class) {
                  // Keep class but remove potential style conflicts
                  // domNode.attribs.class = domNode.attribs.class;
                }

                // Fix fetchpriority attribute name
                if (domNode.attribs?.fetchpriority) {
                  domNode.attribs.fetchPriority = domNode.attribs.fetchpriority;
                  delete domNode.attribs.fetchpriority;
                }

                // Remove empty href attributes to avoid console warnings
                if (domNode.name === 'a') {
                  if (!domNode.attribs?.href || domNode.attribs.href === '' || domNode.attribs.href === '#') {
                    // Convert to span if href is empty or just a hash
                    domNode.name = 'span';
                    delete domNode.attribs.href;
                  } else {
                    // Ensure external links open in new tab
                    domNode.attribs.target = '_blank';
                    domNode.attribs.rel = 'noopener noreferrer';
                  }
                }

                // Use proxy for images to bypass anti-hotlinking
                if (domNode.name === 'img') {
                  // Remove images with empty src to avoid console errors
                  if (!domNode.attribs.src || domNode.attribs.src === '') {
                    return null;
                  }
                  // Convert image URL to proxy URL with referer
                  const originalSrc = domNode.attribs.src;
                  const referer = article?.url ? getRefererFromUrl(article.url) : undefined;
                  domNode.attribs.src = getProxyImageUrl(originalSrc, referer);
                  // Add loading="lazy" for better performance
                  domNode.attribs.loading = 'lazy';
                }
              }
              return domNode;
            }
          }) : <p className="text-muted-foreground italic">No content available</p>}
        </div>
      </article>

      {/* AI Summary Dialog */}
      {article && (
        <AISummaryDialog
          isOpen={showAISummary}
          onClose={() => setShowAISummary(false)}
          title={article.title}
          content={displayContent || ''}
          articleId={article.hash}
          feedId={article.feedId}
          urlHash={article.urlHash}
        />
      )}
    </div>
  );
}
