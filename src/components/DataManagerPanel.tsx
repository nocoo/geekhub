"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  Bug,
  Activity,
  Database,
  FileText,
  HardDrive,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  Filter,
  Download,
  Trash2,
  Eye,
  Server,
  Wifi,
  Cpu,
  MemoryStick,
  Ban,
  Calendar
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';

// Types
interface SystemStats {
  totalFeeds: number;
  activeFeeds: number;
  errorFeeds: number;
  pausedFeeds: number;
  totalArticles: number;
  todayFetched: number;
  storageSize: number;
  lastUpdate: string;
}

interface FeedStatus {
  id: string;
  title: string;
  url: string;
  status: 'active' | 'error' | 'paused' | 'fetching';
  lastFetch: string | null;
  successRate: number;
  errorMessage?: string;
  articleCount: number;
  storageSize: number;
}

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  feedId: string;
  feedTitle: string;
  message: string;
}

interface DataFile {
  path: string;
  name: string;
  size: number;
  modified: string;
  type: 'article' | 'cache' | 'log' | 'index';
  feedId?: string;
  feedTitle?: string;
}

interface DatabaseTableInfo {
  table_name: string;
  row_count: number;
  size_bytes: number;
}

interface DatabaseStorageData {
  tables: DatabaseTableInfo[];
  summary: {
    totalFeeds: number;
    totalArticles: number;
    totalLogs: number;
    recentFetches24h: number;
    storageType: string;
  };
}

interface SystemHealth {
  database: 'connected' | 'error' | 'slow';
  proxy: 'connected' | 'disconnected' | 'error';
  storage: 'healthy' | 'warning' | 'critical';
  memory: number; // percentage
  cpu: number; // percentage
}

interface CleanupResult {
  cleanupNeeded: {
    oldLogs: number;
    recommendation: string;
  };
}

interface CleanupExecuteResult {
  deletedLogs: number;
  errors: string[];
}

interface ArticleCleanupStats {
  totalArticles: number;
  readArticles: number;
  unreadArticles: number;
  oldArticles: number;
  articlesByFeed: Array<{
    feedId: string;
    total: number;
    read: number;
    unread: number;
  }>;
}

interface ArticleCleanupResult {
  deletedCount: number;
  errors: string[];
  message: string;
}

interface DataManagerPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DataManagerPanel({ open, onOpenChange }: DataManagerPanelProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [logFilter, setLogFilter] = useState<'all' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'>('all');

  // Data states
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [feedStatuses, setFeedStatuses] = useState<FeedStatus[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [dbStorage, setDbStorage] = useState<DatabaseStorageData | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [cleanupData, setCleanupData] = useState<CleanupResult | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [articleCleanupStats, setArticleCleanupStats] = useState<ArticleCleanupStats | null>(null);
  const [articleCleanupLoading, setArticleCleanupLoading] = useState(false);
  const [selectedFeedForCleanup, setSelectedFeedForCleanup] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<any>(null);

  // Load all data manager data
  const loadDataManagerData = useCallback(async () => {
    if (!open) return;

    setLoading(true);
    try {
      // Load system stats
      const statsResponse = await fetch('/api/data/stats');
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        setSystemStats(stats);
      }

      // Load feed statuses
      const feedsResponse = await fetch('/api/data/feeds');
      if (feedsResponse.ok) {
        const feeds = await feedsResponse.json();
        setFeedStatuses(feeds);
      }

      // Load aggregated logs
      const logsResponse = await fetch('/api/data/logs');
      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        setLogs(logsData);
      }

      // Load database storage info
      const filesResponse = await fetch('/api/data/files');
      if (filesResponse.ok) {
        const storageData = await filesResponse.json();
        setDbStorage(storageData);
      }

      // Load system health
      const healthResponse = await fetch('/api/data/health');
      if (healthResponse.ok) {
        const health = await healthResponse.json();
        setSystemHealth(health);
      }

      // Load cleanup data
      const cleanupResponse = await fetch('/api/data/cleanup');
      if (cleanupResponse.ok) {
        const cleanup = await cleanupResponse.json();
        setCleanupData(cleanup);
      }

      // Load article cleanup stats
      const articleCleanupResponse = await fetch('/api/data/cleanup-articles');
      if (articleCleanupResponse.ok) {
        const articleStats = await articleCleanupResponse.json();
        setArticleCleanupStats(articleStats);
      }

      // Load storage info
      const storageResponse = await fetch('/api/data/storage');
      if (storageResponse.ok) {
        const storage = await storageResponse.json();
        setStorageInfo(storage);
      }
    } catch (error) {
      console.error('Failed to load data manager data:', error);
      toast.error('加载数据管理数据失败');
    } finally {
      setLoading(false);
    }
  }, [open]);

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadDataManagerData();
    }
  }, [open]);

  // Format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString();
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': case 'connected': case 'healthy': return 'text-green-600 dark:text-green-400';
      case 'error': case 'critical': return 'text-red-600 dark:text-red-400';
      case 'warning': case 'slow': return 'text-yellow-600 dark:text-yellow-400';
      case 'paused': case 'disconnected': return 'text-gray-600 dark:text-gray-400';
      case 'fetching': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-muted-foreground';
    }
  };

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchTerm === '' ||
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.feedTitle.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = logFilter === 'all' || log.level === logFilter;
    return matchesSearch && matchesFilter;
  });

  // Handle cleanup operations
  const handleCleanup = async (options: {
    deleteOldLogs?: boolean;
    olderThanDays?: number;
  }) => {
    setCleanupLoading(true);
    try {
      const response = await fetch('/api/data/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (response.ok) {
        const result = await response.json();

        if (result.errors && result.errors.length > 0) {
          toast.error(`清理完成，但有 ${result.errors.length} 个错误`);
        } else {
          toast.success('清理完成！');
        }

        // 重新加载数据
        loadDataManagerData();
      } else {
        const { error } = await response.json();
        toast.error(error || '清理失败');
      }
    } catch (error) {
      console.error('Cleanup error:', error);
      toast.error('清理操作失败');
    } finally {
      setCleanupLoading(false);
    }
  };

  // Handle article cleanup operations
  const handleArticleCleanup = async (options: {
    deleteRead?: boolean;
    olderThanDays?: number;
    feedId?: string;
  }) => {
    setArticleCleanupLoading(true);
    try {
      const response = await fetch('/api/data/cleanup-articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (response.ok) {
        const result: ArticleCleanupResult = await response.json();

        if (result.errors && result.errors.length > 0) {
          toast.error(`清理完成，但有 ${result.errors.length} 个错误`);
        } else {
          toast.success(result.message || `成功删除 ${result.deletedCount} 篇文章`);
        }

        // 重新加载数据
        loadDataManagerData();
      } else {
        const { error } = await response.json();
        toast.error(error || '清理失败');
      }
    } catch (error) {
      console.error('Article cleanup error:', error);
      toast.error('清理文章失败');
    } finally {
      setArticleCleanupLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Bug className="w-5 h-5 text-primary" />
            Data Manager - GeekHub System Monitor
          </DialogTitle>
          <DialogDescription>
            数据管理中心，监控所有Feed抓取状态、日志和存储数据
          </DialogDescription>
        </DialogHeader>

        {loading && !systemStats ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Stats Overview */}
            {systemStats && (
              <div className="flex-shrink-0 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{systemStats.totalFeeds}</div>
                  <div className="text-xs text-muted-foreground">总Feed数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{systemStats.activeFeeds}</div>
                  <div className="text-xs text-muted-foreground">活跃Feed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{systemStats.totalArticles}</div>
                  <div className="text-xs text-muted-foreground">总文章数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {storageInfo ? storageInfo.totalSizeFormatted : formatBytes(systemStats.storageSize)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {storageInfo ? `已用 ${storageInfo.usage.databasePercent}%` : '存储大小'}
                  </div>
                </div>
              </div>
            )}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-5 flex-shrink-0">
                <TabsTrigger value="overview" className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  <span className="hidden sm:inline">概览</span>
                </TabsTrigger>
                <TabsTrigger value="feeds" className="flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  <span className="hidden sm:inline">Feed监控</span>
                </TabsTrigger>
                <TabsTrigger value="logs" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">日志中心</span>
                </TabsTrigger>
                <TabsTrigger value="files" className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4" />
                  <span className="hidden sm:inline">数据浏览</span>
                </TabsTrigger>
                <TabsTrigger value="system" className="flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  <span className="hidden sm:inline">系统状态</span>
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="flex-1 overflow-y-auto mt-4">
                <div className="space-y-4">
                  {systemStats && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Activity className="w-4 h-4" />
                            抓取状态
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">活跃Feed</span>
                            <span className="text-sm font-medium text-green-600">{systemStats.activeFeeds}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">错误Feed</span>
                            <span className="text-sm font-medium text-red-600">{systemStats.errorFeeds}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">暂停Feed</span>
                            <span className="text-sm font-medium text-gray-600">{systemStats.pausedFeeds}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">今日抓取</span>
                            <span className="text-sm font-medium text-blue-600">{systemStats.todayFetched}</span>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <HardDrive className="w-4 h-4" />
                            Supabase 存储统计
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {storageInfo ? (
                            <>
                              <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">数据库使用</span>
                                <span className="text-sm font-medium">{storageInfo.usage.databaseUsedFormatted} / {storageInfo.usage.databaseLimitFormatted}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">使用率</span>
                                <span className="text-sm font-medium">{storageInfo.usage.databasePercent}%</span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{ width: `${Math.min(parseFloat(storageInfo.usage.databasePercent), 100)}%` }}
                                />
                              </div>
                              <div className="border-t pt-3 space-y-2">
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">文章内容</span>
                                  <span>{storageInfo.breakdownFormatted.articles}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">日志</span>
                                  <span>{storageInfo.breakdownFormatted.logs}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">Feeds</span>
                                  <span>{storageInfo.breakdownFormatted.feeds}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">其他</span>
                                  <span>{formatBytes(storageInfo.breakdown.categories + storageInfo.breakdown.userArticles + storageInfo.breakdown.fetchStatus)}</span>
                                </div>
                              </div>
                              <div className="border-t pt-3 text-xs text-muted-foreground">
                                Supabase 免费额度：{storageInfo.supabaseLimits.freeDatabaseLimitFormatted} 数据库存储
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">总文章数</span>
                                <span className="text-sm font-medium">{systemStats.totalArticles.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">存储大小</span>
                                <span className="text-sm font-medium">{formatBytes(systemStats.storageSize)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">平均文章大小</span>
                                <span className="text-sm font-medium">
                                  {systemStats.totalArticles > 0
                                    ? formatBytes(systemStats.storageSize / systemStats.totalArticles)
                                    : '0 B'
                                  }
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">最后更新</span>
                                <span className="text-sm font-medium">{formatDate(systemStats.lastUpdate)}</span>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Recent Errors */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        最近错误
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-32">
                        {filteredLogs.filter(log => log.level === 'ERROR').slice(0, 10).map((log, i) => (
                          <div key={i} className="flex items-start gap-2 py-1 text-sm">
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {formatDate(log.timestamp).slice(-8)}
                            </span>
                            <span className="text-xs font-medium text-red-600 flex-shrink-0">
                              {log.feedTitle}
                            </span>
                            <span className="text-xs text-foreground break-all">
                              {log.message}
                            </span>
                          </div>
                        ))}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Feed Monitor Tab */}
              <TabsContent value="feeds" className="flex-1 overflow-y-auto mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Feed状态监控</h3>
                    <Button size="sm" onClick={loadDataManagerData} disabled={loading}>
                      <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                      刷新
                    </Button>
                  </div>

                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Feed</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>最后抓取</TableHead>
                          <TableHead>成功率</TableHead>
                          <TableHead>文章数</TableHead>
                          <TableHead>存储</TableHead>
                          <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {feedStatuses.map((feed) => (
                          <TableRow key={feed.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium text-sm">{feed.title}</div>
                                <div className="text-xs text-muted-foreground truncate max-w-xs">
                                  {feed.url}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={feed.status === 'active' ? 'default' :
                                        feed.status === 'error' ? 'destructive' : 'secondary'}
                                className="text-xs"
                              >
                                {feed.status === 'active' ? '正常' :
                                 feed.status === 'error' ? '错误' :
                                 feed.status === 'paused' ? '暂停' : '抓取中'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {feed.lastFetch ? formatDate(feed.lastFetch) : '从未'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={feed.successRate} className="w-16 h-2" />
                                <span className="text-xs">{feed.successRate}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{feed.articleCount}</TableCell>
                            <TableCell className="text-sm">{formatBytes(feed.storageSize)}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost">
                                <Eye className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>

              {/* Logs Tab */}
              <TabsContent value="logs" className="flex-1 flex flex-col overflow-hidden mt-4">
                <div className="flex-shrink-0 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">聚合日志中心</h3>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        导出
                      </Button>
                      <Button size="sm" onClick={loadDataManagerData} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        刷新
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Input
                        placeholder="搜索日志内容或Feed名称..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <Select value={logFilter} onValueChange={(value: any) => setLogFilter(value)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="ERROR">错误</SelectItem>
                        <SelectItem value="WARNING">警告</SelectItem>
                        <SelectItem value="SUCCESS">成功</SelectItem>
                        <SelectItem value="INFO">信息</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="bg-terminal rounded-lg p-4 font-mono text-xs space-y-1">
                      {filteredLogs.length === 0 ? (
                        <p className="text-muted-foreground">没有找到匹配的日志</p>
                      ) : (
                        filteredLogs.map((log, i) => (
                          <div key={i} className="flex gap-3">
                            <span className="text-muted-foreground flex-shrink-0">
                              [{formatDate(log.timestamp).slice(0, 19)}]
                            </span>
                            <span className={cn('flex-shrink-0', getStatusColor(log.level.toLowerCase()))}>
                              {log.level}
                            </span>
                            <span className="text-blue-400 flex-shrink-0 max-w-32 truncate">
                              {log.feedTitle}
                            </span>
                            <span className="text-foreground break-all">
                              {log.message}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>

              {/* Files Tab */}
              <TabsContent value="files" className="flex-1 overflow-y-auto mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">数据库存储</h3>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCleanup({ deleteOldLogs: true })}
                        disabled={cleanupLoading || !cleanupData?.cleanupNeeded.oldLogs}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        清理旧日志
                      </Button>
                      <Button size="sm" onClick={loadDataManagerData} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        刷新
                      </Button>
                    </div>
                  </div>

                  {/* Cleanup recommendation */}
                  {cleanupData && cleanupData.cleanupNeeded.oldLogs > 0 && (
                    <Card className="border-orange-200 dark:border-orange-800">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900">
                            <Trash2 className="w-4 h-4 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-medium">{cleanupData.cleanupNeeded.recommendation}</p>
                            <p className="text-sm text-muted-foreground">
                              删除超过30天的抓取日志以释放空间
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Article cleanup section */}
                  {articleCleanupStats && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Ban className="w-4 h-4" />
                          文章清理
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Article statistics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <div className="text-2xl font-bold">{articleCleanupStats.totalArticles}</div>
                            <div className="text-xs text-muted-foreground">总文章数</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-blue-600">{articleCleanupStats.readArticles}</div>
                            <div className="text-xs text-muted-foreground">已读</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-green-600">{articleCleanupStats.unreadArticles}</div>
                            <div className="text-xs text-muted-foreground">未读</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-orange-600">{articleCleanupStats.oldArticles}</div>
                            <div className="text-xs text-muted-foreground">30天前</div>
                          </div>
                        </div>

                        {/* Cleanup buttons */}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleArticleCleanup({ deleteRead: true })}
                            disabled={articleCleanupLoading || articleCleanupStats.readArticles === 0}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            删除所有已读文章 ({articleCleanupStats.readArticles})
                          </Button>

                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleArticleCleanup({ olderThanDays: 30 })}
                            disabled={articleCleanupLoading || articleCleanupStats.oldArticles === 0}
                          >
                            <Calendar className="w-4 h-4 mr-2" />
                            删除30天前的文章 ({articleCleanupStats.oldArticles})
                          </Button>

                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleArticleCleanup({ olderThanDays: 60 })}
                            disabled={articleCleanupLoading}
                          >
                            <Calendar className="w-4 h-4 mr-2" />
                            删除60天前的文章
                          </Button>

                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleArticleCleanup({ olderThanDays: 90 })}
                            disabled={articleCleanupLoading}
                          >
                            <Calendar className="w-4 h-4 mr-2" />
                            删除90天前的文章
                          </Button>
                        </div>

                        {/* Feed-specific cleanup */}
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">按 Feed 清理</h4>
                          <div className="max-h-48 overflow-y-auto border rounded-lg">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Feed</TableHead>
                                  <TableHead>总计</TableHead>
                                  <TableHead>已读</TableHead>
                                  <TableHead>未读</TableHead>
                                  <TableHead>操作</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {articleCleanupStats.articlesByFeed
                                  .filter(feed => feed.total > 0)
                                  .slice(0, 10)
                                  .map((feed) => {
                                    const feedInfo = feedStatuses.find(f => f.id === feed.feedId);
                                    return (
                                      <TableRow key={feed.feedId}>
                                        <TableCell className="text-sm max-w-xs truncate">
                                          {feedInfo?.title || feed.feedId}
                                        </TableCell>
                                        <TableCell className="text-sm">{feed.total}</TableCell>
                                        <TableCell className="text-sm text-blue-600">{feed.read}</TableCell>
                                        <TableCell className="text-sm text-green-600">{feed.unread}</TableCell>
                                        <TableCell>
                                          {feed.read > 0 && (
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => handleArticleCleanup({
                                                feedId: feed.feedId,
                                                deleteRead: true
                                              })}
                                              disabled={articleCleanupLoading}
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </Button>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {dbStorage && (
                    <div className="space-y-4">
                      {/* Storage summary */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-muted-foreground">Feeds</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-xl font-bold">{dbStorage.summary.totalFeeds}</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-muted-foreground">Articles</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-xl font-bold">{dbStorage.summary.totalArticles}</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-muted-foreground">Logs</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-xl font-bold">{dbStorage.summary.totalLogs}</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-muted-foreground">Fetches (24h)</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-xl font-bold">{dbStorage.summary.recentFetches24h}</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-muted-foreground">Storage</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-xl font-bold text-blue-600">{dbStorage.summary.storageType}</div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Database tables */}
                      <div className="border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Table Name</TableHead>
                              <TableHead>Rows</TableHead>
                              <TableHead>Size</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dbStorage.tables.map((table, i) => (
                              <TableRow key={i}>
                                <TableCell>
                                  <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                    {table.table_name}
                                  </code>
                                </TableCell>
                                <TableCell className="text-sm">{table.row_count.toLocaleString()}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  Managed by Supabase
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* System Status Tab */}
              <TabsContent value="system" className="flex-1 overflow-y-auto mt-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">系统健康状态</h3>

                  {systemHealth && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Database className="w-4 h-4" />
                            数据库连接
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2">
                            <div className={cn('w-3 h-3 rounded-full',
                              systemHealth.database === 'connected' ? 'bg-green-500' :
                              systemHealth.database === 'slow' ? 'bg-yellow-500' : 'bg-red-500'
                            )} />
                            <span className={cn('text-sm font-medium', getStatusColor(systemHealth.database))}>
                              {systemHealth.database === 'connected' ? '连接正常' :
                               systemHealth.database === 'slow' ? '连接缓慢' : '连接错误'}
                            </span>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Wifi className="w-4 h-4" />
                            代理状态
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2">
                            <div className={cn('w-3 h-3 rounded-full',
                              systemHealth.proxy === 'connected' ? 'bg-green-500' :
                              systemHealth.proxy === 'disconnected' ? 'bg-gray-500' : 'bg-red-500'
                            )} />
                            <span className={cn('text-sm font-medium', getStatusColor(systemHealth.proxy))}>
                              {systemHealth.proxy === 'connected' ? '代理正常' :
                               systemHealth.proxy === 'disconnected' ? '未使用代理' : '代理错误'}
                            </span>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <MemoryStick className="w-4 h-4" />
                            内存使用
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>使用率</span>
                              <span>{systemHealth.memory}%</span>
                            </div>
                            <Progress value={systemHealth.memory} className="h-2" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Cpu className="w-4 h-4" />
                            CPU使用
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>使用率</span>
                              <span>{systemHealth.cpu}%</span>
                            </div>
                            <Progress value={systemHealth.cpu} className="h-2" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}