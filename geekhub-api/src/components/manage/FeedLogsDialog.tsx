"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RefreshCw, FileText, Calendar, Clock, HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import { fetchFeedWithSettings } from '@/lib/fetch-with-settings';
import { formatFeedUrlForDisplay } from '@/lib/rsshub-display';
import { useSettings } from '@/lib/settings';

interface Article {
  path: string;
  title: string;
  date: string;
  size: number;
}

interface LogsData {
  feed: {
    id: string;
    title: string;
    url: string;
    url_hash: string;
    last_fetched_at: string | null;
    total_articles: number;
  };
  logs: string[];
  articles: Article[];
  stats: {
    totalArticles: number;
    totalSize: number;
  };
}

interface FeedLogsDialogProps {
  feedId: string;
  feedTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString();
}

export function FeedLogsDialog({ feedId, feedTitle, open, onOpenChange }: FeedLogsDialogProps) {
  const { settings } = useSettings();
  const [data, setData] = useState<LogsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'logs' | 'articles'>('logs');
  const [fetching, setFetching] = useState(false);

  // Format URL for display (convert RssHub URLs back to rsshub:// format)
  const displayUrl = data?.feed.url
    ? formatFeedUrlForDisplay(data.feed.url, settings.rsshub?.enabled ? settings.rsshub.url : undefined)
    : '';

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/feeds/${feedId}/logs`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        const { error } = await response.json();
        toast.error(error || 'Failed to load logs');
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
      toast.error('Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const handleFetch = async () => {
    setFetching(true);
    try {
      const response = await fetchFeedWithSettings(feedId);
      if (response.ok) {
        toast.success('Fetch task started');
        // Reload logs after a delay
        setTimeout(() => loadData(), 2000);
      } else {
        const { error } = await response.json();
        toast.error(error || 'Failed to start fetch');
      }
    } catch (error) {
      console.error('Failed to fetch:', error);
      toast.error('Failed to start fetch');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, feedId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">{feedTitle}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1 font-mono">
                {displayUrl}
              </p>
            </div>
            <Button
              onClick={handleFetch}
              disabled={fetching}
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
              {fetching ? 'Fetching...' : 'Fetch Now'}
            </Button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 统计信息 */}
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg mb-4 flex-shrink-0">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Articles:</span>
                <span className="font-medium">{data.stats.totalArticles}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <HardDrive className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Size:</span>
                <span className="font-medium">{formatBytes(data.stats.totalSize)}</span>
              </div>
              {data.feed.last_fetched_at && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Last fetch:</span>
                  <span className="font-medium">{formatDate(data.feed.last_fetched_at)}</span>
                </div>
              )}
            </div>

            {/* 标签切换 */}
            <div className="flex gap-2 border-b border-border flex-shrink-0">
              <button
                onClick={() => setActiveTab('logs')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'logs'
                    ? 'text-foreground border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Fetch Logs
              </button>
              <button
                onClick={() => setActiveTab('articles')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'articles'
                    ? 'text-foreground border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Articles ({data.stats.totalArticles})
              </button>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto mt-4">
              {activeTab === 'logs' ? (
                <div className="bg-terminal rounded-lg p-4 font-mono text-xs">
                  {data.logs.length === 0 ? (
                    <p className="text-muted-foreground">No logs available yet.</p>
                  ) : (
                    <div className="space-y-1">
                      {data.logs.map((log, i) => {
                        const parts = log.match(/^\[([^\]]+)\]\s+(\w+)\s+(.*)$/);
                        if (!parts) return <div key={i}>{log}</div>;

                        const [, timestamp, level, message] = parts;
                        const levelColor = level === 'SUCCESS' ? 'text-emerald-600 dark:text-emerald-400' :
                                          level === 'ERROR' ? 'text-red-600 dark:text-red-400' :
                                          level === 'WARNING' ? 'text-yellow-600 dark:text-yellow-400' :
                                          'text-blue-600 dark:text-blue-400';

                        return (
                          <div key={i} className="flex gap-3">
                            <span className="text-muted-foreground flex-shrink-0">[{timestamp.slice(0, 19)}]</span>
                            <span className={levelColor + ' flex-shrink-0'}>{level}</span>
                            <span className="text-foreground break-all">{message}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {data.articles.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No articles found.</p>
                  ) : (
                    data.articles.map((article, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate">{article.title}</h4>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(article.date)}
                              </span>
                              <span className="flex items-center gap-1">
                                <HardDrive className="w-3 h-3" />
                                {formatBytes(article.size)}
                              </span>
                            </div>
                          </div>
                          <code className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">
                            {article.path.split('/').slice(-2).join('/')}
                          </code>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
