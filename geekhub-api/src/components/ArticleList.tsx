import { useEffect, useCallback } from 'react';
import { Rss } from 'lucide-react';
import { Article } from '@/hooks/useDatabase';
import { cn } from '@/lib/utils';
import { useFormatTime } from '@/lib/format-time';

interface ArticleListProps {
  articles: Article[];
  selectedArticle: Article | null;
  onSelectArticle: (article: Article) => void;
  isLoading?: boolean;
}

export function ArticleList({ articles, selectedArticle, onSelectArticle, isLoading }: ArticleListProps) {
  const formatTime = useFormatTime();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!articles.length) return;

    const currentIndex = selectedArticle
      ? articles.findIndex(a => a.id === selectedArticle.id)
      : -1;

    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      const nextIndex = currentIndex < articles.length - 1 ? currentIndex + 1 : 0;
      onSelectArticle(articles[nextIndex]);
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : articles.length - 1;
      onSelectArticle(articles[prevIndex]);
    }
  }, [articles, selectedArticle, onSelectArticle]);

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

  if (articles.length === 0) {
    return (
      <div className="w-96 flex-shrink-0 border-r border-subtle h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-sm">没有找到文章</p>
          <p className="text-xs mt-1">选择一个订阅源开始阅读</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 flex-shrink-0 border-r border-subtle h-[calc(100vh-3.5rem)] overflow-y-auto hover-scrollbar bg-card/50">
      <div className="p-3 border-b border-subtle sticky top-0 bg-card/95 backdrop-blur-sm z-10">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            {articles.length} 篇文章
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            ↑↓ 导航
          </span>
        </div>
      </div>

      <div className="divide-y divide-border/30">
        {articles.map(article => (
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
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
