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
  MemoryStick
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

interface SystemHealth {
  database: 'connected' | 'error' | 'slow';
  proxy: 'connected' | 'disconnected' | 'error';
  storage: 'healthy' | 'warning' | 'critical';
  memory: number; // percentage
  cpu: number; // percentage
}

interface CleanupResult {
  orphanedDirectories: string[];
  oldCacheFiles: string[];
  totalSizeFreed: number;
  errors: string[];
}

interface DebugPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DebugPanel({ open, onOpenChange }: DebugPanelProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [logFilter, setLogFilter] = useState<'all' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'>('all');

  // Data states
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [feedStatuses, setFeedStatuses] = useState<FeedStatus[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [dataFiles, setDataFiles] = useState<DataFile[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [cleanupData, setCleanupData] = useState<CleanupResult | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  // Load all debug data
  const loadDebugData = useCallback(async () => {
    if (!open) return;

    setLoading(true);
    try {
      // Load system stats
      const statsResponse = await fetch('/api/debug/stats');
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        setSystemStats(stats);
      }

      // Load feed statuses
      const feedsResponse = await fetch('/api/debug/feeds');
      if (feedsResponse.ok) {
        const feeds = await feedsResponse.json();
        setFeedStatuses(feeds);
      }

      // Load aggregated logs
      const logsResponse = await fetch('/api/debug/logs');
      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        setLogs(logsData);
      }

      // Load data files
      const filesResponse = await fetch('/api/debug/files');
      if (filesResponse.ok) {
        const files = await filesResponse.json();
        setDataFiles(files);
      }

      // Load system health
      const healthResponse = await fetch('/api/debug/health');
      if (healthResponse.ok) {
        const health = await healthResponse.json();
        setSystemHealth(health);
      }

      // Load cleanup data
      const cleanupResponse = await fetch('/api/debug/cleanup');
      if (cleanupResponse.ok) {
        const cleanup = await cleanupResponse.json();
        setCleanupData(cleanup);
      }
    } catch (error) {
      console.error('Failed to load debug data:', error);
      toast.error('加载调试数据失败');
    } finally {
      setLoading(false);
    }
  }, [open]);

  // Auto-refresh data
  useEffect(() => {
    loadDebugData();

    if (open) {
      const interval = setInterval(loadDebugData, 10000); // Refresh every 10s
      return () => clearInterval(interval);
    }
  }, [open, loadDebugData]);

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
    cleanOrphanedDirectories?: boolean;
    cleanOldCacheFiles?: boolean;
    specificPaths?: string[];
  }) => {
    setCleanupLoading(true);
    try {
      const response = await fetch('/api/debug/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (response.ok) {
        const result = await response.json();

        if (result.errors.length > 0) {
          toast.error(`清理完成，但有 ${result.errors.length} 个错误`);
        } else {
          toast.success(`清理完成！释放了 ${formatBytes(result.totalSizeFreed)} 空间`);
        }

        // 重新加载数据
        loadDebugData();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Bug className="w-5 h-5 text-primary" />
            Debug Panel - GeekHub System Monitor
          </DialogTitle>
          <DialogDescription>
            系统级调试面板，监控所有Feed抓取状态、日志和数据文件
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
                  <div className="text-2xl font-bold text-purple-600">{formatBytes(systemStats.storageSize)}</div>
                  <div className="text-xs text-muted-foreground">存储大小</div>
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
                            存储统计
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
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
                    <Button size="sm" onClick={loadDebugData} disabled={loading}>
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
                      <Button size="sm" onClick={loadDebugData} disabled={loading}>
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
                    <h3 className="text-lg font-semibold">数据文件浏览器</h3>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCleanup({ cleanOldCacheFiles: true })}
                        disabled={cleanupLoading}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        清理缓存
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCleanup({ cleanOrphanedDirectories: true })}
                        disabled={cleanupLoading}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        清理孤立目录
                      </Button>
                      <Button size="sm" onClick={loadDebugData} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        刷新
                      </Button>
                    </div>
                  </div>

                  {/* Cleanup Status */}
                  {cleanupData && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">孤立目录</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-orange-600">
                            {cleanupData.orphanedDirectories.length}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            数据库中不存在的Feed目录
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">旧缓存文件</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-blue-600">
                            {cleanupData.oldCacheFiles.length}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            超过7天的RSS缓存文件
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">可释放空间</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-green-600">
                            {formatBytes(cleanupData.totalSizeFreed)}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            清理后可释放的存储空间
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>文件路径</TableHead>
                          <TableHead>类型</TableHead>
                          <TableHead>Feed</TableHead>
                          <TableHead>大小</TableHead>
                          <TableHead>修改时间</TableHead>
                          <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dataFiles.slice(0, 100).map((file, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                {file.path}
                              </code>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {file.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm max-w-32 truncate">
                              {file.feedTitle || '-'}
                            </TableCell>
                            <TableCell className="text-sm">{formatBytes(file.size)}</TableCell>
                            <TableCell className="text-sm">{formatDate(file.modified)}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCleanup({ specificPaths: [file.path] })}
                                disabled={cleanupLoading}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
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