import { formatDistanceToNow, format } from 'date-fns';
import parse from 'html-react-parser';
import { ExternalLink, Bookmark, Share2, MoreHorizontal } from 'lucide-react';
import { Article } from '@/lib/mockData';
import { Button } from '@/components/ui/button';

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
  if (!article) {
    return (
      <div className="flex-1 h-[calc(100vh-3.5rem)] flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
            <span className="text-3xl">📖</span>
          </div>
          <h2 className="text-lg font-medium text-foreground">Select an article</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose an article from the list to start reading
          </p>
          <div className="mt-4 text-xs text-muted-foreground font-mono">
            Pro tip: Use <kbd className="px-1.5 py-0.5 bg-muted rounded">↑</kbd> <kbd className="px-1.5 py-0.5 bg-muted rounded">↓</kbd> or <kbd className="px-1.5 py-0.5 bg-muted rounded">j</kbd> <kbd className="px-1.5 py-0.5 bg-muted rounded">k</kbd> to navigate
          </div>
        </div>
      </div>
    );
  }

  const avatarColor = stringToColor(article.feedName);
  const avatarChar = getFirstChar(article.feedName);

  return (
    <div className="flex-1 h-[calc(100vh-3.5rem)] overflow-y-auto hover-scrollbar bg-background">
      <article className="max-w-3xl mx-auto px-6 py-8">
        {/* Article header */}
        <header className="mb-8">
          {/* Source */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">{article.feedIcon}</span>
            <span className="text-sm font-medium text-muted-foreground">
              {article.feedName}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold font-sans leading-tight text-foreground mb-4">
            {article.title}
          </h1>

          {/* Author & Date */}
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center text-white font-medium text-sm`}>
              {avatarChar}
            </div>
            <div>
              <div className="font-medium text-foreground">{article.feedName}</div>
              <div className="text-sm text-muted-foreground">
                {format(article.publishedAt, 'MMMM d, yyyy')} · {formatDistanceToNow(article.publishedAt, { addSuffix: true })}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pb-6 border-b border-subtle">
            <Button variant="outline" size="sm" className="gap-2">
              <Bookmark className="w-4 h-4" />
              Save
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Share2 className="w-4 h-4" />
              Share
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <ExternalLink className="w-4 h-4" />
              Original
            </Button>
            <Button variant="ghost" size="icon" className="ml-auto h-8 w-8">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Featured image */}
        {article.thumbnail && (
          <figure className="mb-8 -mx-6 md:mx-0">
            <img
              src={article.thumbnail}
              alt=""
              className="w-full aspect-video object-cover rounded-lg md:rounded-xl"
            />
          </figure>
        )}

        {/* Content - Parse HTML */}
        <div className="prose prose-geek max-w-none font-serif text-lg leading-relaxed m-0">
          {article.content ? parse(article.content) : <p className="text-muted-foreground italic">No content available</p>}
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-subtle">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Read from <span className="font-medium text-foreground">{article.feedName}</span>
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <ExternalLink className="w-4 h-4" />
              View Original
            </Button>
          </div>
        </footer>
      </article>
    </div>
  );
}
