import { useState } from 'react';
import { ChevronDown, ChevronRight, Inbox, Star, Clock } from 'lucide-react';
import { feeds } from '@/lib/mockData';
import { CrawlerTerminal } from './CrawlerTerminal';
import { cn } from '@/lib/utils';

interface SidebarProps {
  selectedFeed: string | null;
  onSelectFeed: (feedId: string | null) => void;
}

export function Sidebar({ selectedFeed, onSelectFeed }: SidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['Tech', 'Dev', 'Design']);

  const categories = [...new Set(feeds.map(f => f.category))];

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const getTotalUnread = () => feeds.reduce((acc, f) => acc + f.unreadCount, 0);

  return (
    <aside className="w-64 flex-shrink-0 border-r border-subtle h-[calc(100vh-3.5rem)] flex flex-col bg-sidebar">
      {/* Quick Access */}
      <div className="p-3 space-y-1">
        <button
          onClick={() => onSelectFeed(null)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
            selectedFeed === null
              ? "bg-accent text-accent-foreground"
              : "text-sidebar-foreground hover:bg-accent/50"
          )}
        >
          <Inbox className="w-4 h-4 text-primary" />
          <span className="font-medium">All Articles</span>
          <span className="ml-auto text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">
            {getTotalUnread()}
          </span>
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-accent/50 transition-colors">
          <Star className="w-4 h-4 text-yellow-500" />
          <span>Starred</span>
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-accent/50 transition-colors">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span>Read Later</span>
        </button>
      </div>

      <div className="h-px bg-border/40 mx-3" />

      {/* Feeds by Category */}
      <div className="flex-1 overflow-y-auto hover-scrollbar p-3 space-y-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3">
          Feeds
        </span>
        
        {categories.map(category => {
          const categoryFeeds = feeds.filter(f => f.category === category);
          const isExpanded = expandedCategories.includes(category);
          const categoryUnread = categoryFeeds.reduce((acc, f) => acc + f.unreadCount, 0);

          return (
            <div key={category}>
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-sidebar-foreground hover:bg-accent/50 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span className="font-medium">{category}</span>
                {categoryUnread > 0 && (
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                    {categoryUnread}
                  </span>
                )}
              </button>

              {isExpanded && (
                <div className="ml-4 mt-1 space-y-0.5">
                  {categoryFeeds.map(feed => (
                    <button
                      key={feed.id}
                      onClick={() => onSelectFeed(feed.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                        selectedFeed === feed.id
                          ? "bg-accent text-accent-foreground"
                          : "text-sidebar-foreground/80 hover:bg-accent/50"
                      )}
                    >
                      <span className="text-sm">{feed.icon}</span>
                      <span className="truncate">{feed.name}</span>
                      {feed.unreadCount > 0 && (
                        <span className="ml-auto text-[10px] font-mono bg-primary/10 text-primary px-1 rounded">
                          {feed.unreadCount}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Crawler Terminal */}
      <div className="p-3 border-t border-subtle">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2 block">
          The Crawler
        </span>
        <CrawlerTerminal />
      </div>
    </aside>
  );
}
