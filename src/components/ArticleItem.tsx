import { memo, forwardRef } from 'react';
import { Rss } from 'lucide-react';
import { Article } from '@/hooks/useDatabase';
import { cn } from '@/lib/utils';
import { getProxyImageUrl, getRefererFromUrl } from '@/lib/image-proxy';

interface ArticleItemProps {
    article: Article;
    isSelected: boolean;
    isRead: boolean;
    onSelect: (article: Article) => void;
    formatTime: (date: Date | number | string | null | undefined) => string;
}

export const ArticleItem = memo(forwardRef<HTMLButtonElement, ArticleItemProps>(({
    article,
    isSelected,
    isRead,
    onSelect,
    formatTime,
}, ref) => {
    return (
        <button
            ref={ref}
            onClick={() => onSelect(article)}
            data-article-id={article.id}
            className={cn(
                "w-full text-left p-4 transition-all duration-150 relative group",
                !isRead && "bg-primary/5",
                isSelected
                    ? "bg-accent"
                    : "hover:bg-accent/50"
            )}
        >
            {/* Selection indicator */}
            {isSelected && (
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />
            )}

            <div className="flex gap-3">
                <div className="flex-1 min-w-0">
                    {/* Unread indicator */}
                    <div className="flex items-start gap-2">
                        {!isRead && (
                            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                        )}
                        <h3 className={cn(
                            "text-sm leading-snug line-clamp-2",
                            !isRead ? "font-semibold text-foreground" : "font-medium text-foreground/90"
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
    );
}));

ArticleItem.displayName = 'ArticleItem';
