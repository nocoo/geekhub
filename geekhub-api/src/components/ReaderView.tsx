import { formatDistanceToNow, format } from 'date-fns';
import parse from 'html-react-parser';
import { ExternalLink, Bookmark, Share2, Expand, Minimize2, Image, ImageOff } from 'lucide-react';
import { Article } from '@/hooks/useDatabase';
import { Button } from '@/components/ui/button';
import { useState, useCallback } from 'react';

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
  const [fullWidth, setFullWidth] = useState(false);
  const [showImages, setShowImages] = useState(true);

  const toggleWidth = useCallback(() => setFullWidth(prev => !prev), []);
  const toggleImages = useCallback(() => setShowImages(prev => !prev), []);

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

  // Process content to hide images if needed
  const processedContent = showImages
    ? article.content
    : article.content?.replace(/<img[^>]*>/gi, '');

  return (
    <div className="flex-1 h-[calc(100vh-3.5rem)] overflow-y-auto hover-scrollbar bg-background">
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
                {article.publishedAt ? formatDistanceToNow(article.publishedAt, { addSuffix: true }) : 'No date'}
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
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Save">
                <Bookmark className="w-4 h-4" />
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
              if (domNode.type === 'tag' && domNode.attribs?.fetchpriority) {
                domNode.attribs.fetchPriority = domNode.attribs.fetchpriority;
                delete domNode.attribs.fetchpriority;
              }
              return domNode;
            }
          }) : <p className="text-muted-foreground italic">No content available</p>}
        </div>
      </article>
    </div>
  );
}
