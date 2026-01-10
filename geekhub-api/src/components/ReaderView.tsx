import { format } from 'date-fns';
import parse from 'html-react-parser';
import { ExternalLink, Bookmark, Share2, Expand, Minimize2, Image, ImageOff, Bug, Download, Clock } from 'lucide-react';
import { Article, useBookmarkArticle, useUnbookmarkArticle, useSaveForLater, useRemoveFromLater } from '@/hooks/useDatabase';
import { Button } from '@/components/ui/button';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { toast } from '@/components/ui/sonner';
import { getProxyImageUrl, getRefererFromUrl } from '@/lib/image-proxy';
import { useFormatTime } from '@/lib/format-time';

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
  const [fullWidth, setFullWidth] = useState(false);
  const [showImages, setShowImages] = useState(true);
  const [enhancedContent, setEnhancedContent] = useState<string | null>(null);
  const [isLoadingFull, setIsLoadingFull] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isReadLater, setIsReadLater] = useState(false);

  // Ref for the scrollable container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const toggleWidth = useCallback(() => setFullWidth(prev => !prev), []);
  const toggleImages = useCallback(() => setShowImages(prev => !prev), []);

  const bookmarkArticle = useBookmarkArticle();
  const unbookmarkArticle = useUnbookmarkArticle();
  const saveForLater = useSaveForLater();
  const removeFromLater = useRemoveFromLater();

  // Handle bookmark toggle
  const handleBookmark = useCallback(async () => {
    if (!article) return;

    try {
      if (isBookmarked) {
        await unbookmarkArticle.mutateAsync(article.hash || '');
        setIsBookmarked(false);
        toast.success('已取消收藏');
      } else {
        await bookmarkArticle.mutateAsync({
          articleHash: article.hash || '',
          feedId: article.feedId,
          articleTitle: article.title,
          articleUrl: article.url,
        });
        setIsBookmarked(true);
        toast.success('已收藏');
      }
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
      toast.error('操作失败');
    }
  }, [article, isBookmarked, bookmarkArticle, unbookmarkArticle]);

  // Handle read later toggle
  const handleReadLater = useCallback(async () => {
    if (!article) return;

    try {
      if (isReadLater) {
        await removeFromLater.mutateAsync(article.hash || '');
        setIsReadLater(false);
        toast.success('已从稍后阅读移除');
      } else {
        await saveForLater.mutateAsync({
          articleHash: article.hash || '',
          feedId: article.feedId,
          articleTitle: article.title,
          articleUrl: article.url,
        });
        setIsReadLater(true);
        toast.success('已添加到稍后阅读');
      }
    } catch (error) {
      console.error('Failed to toggle read later:', error);
      toast.error('操作失败');
    }
  }, [article, isReadLater, saveForLater, removeFromLater]);

  // Check if content is short (likely a summary only)
  const isShortContent = useMemo(() => {
    if (!article?.content) return false;
    // Content is considered short if less than 500 chars
    return article.content.length < 500;
  }, [article?.content]);

  // Reset enhanced content when article changes
  useEffect(() => {
    setEnhancedContent(null);
  }, [article?.id]);

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
  const displayContent = enhancedContent || article?.content;

  // Fetch full content from original URL
  const handleFetchFull = useCallback(async () => {
    if (!article?.url) return;

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
        toast.success(`已获取完整内容 (${(data.content.length / 1000).toFixed(1)}k 字符)`);
      } else {
        throw new Error(data.error || 'No content returned');
      }
    } catch (error) {
      console.error('Failed to fetch full content:', error);
      toast.error('获取完整内容失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsLoadingFull(false);
    }
  }, [article]);

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
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Toggle width" onClick={toggleWidth}>
                {fullWidth ? <Minimize2 className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Toggle images" onClick={toggleImages}>
                {showImages ? <Image className="w-4 h-4" /> : <ImageOff className="w-4 h-4" />}
              </Button>
              {isShortContent && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Fetch full content"
                  onClick={handleFetchFull}
                  disabled={isLoadingFull}
                >
                  <Download className={`w-4 h-4 ${isLoadingFull ? 'animate-spin' : ''}`} />
                </Button>
              )}
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

        {/* Content - Parse HTML */}
        <div className="prose prose-geek max-w-none font-serif text-lg leading-relaxed m-0">
          {processedContent ? parse(processedContent, {
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
    </div>
  );
}
