import { useEffect, useState, useRef } from 'react';
import { useLogsEvents, useSSE } from '@/contexts/SSEContext';

interface LogLine {
  timestamp: string;
  level: string;
  status?: number;
  action: string;
  url: string;
  duration?: string;
  message?: string;
  feedTitle?: string;
}

export function CrawlerTerminal() {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [cursorVisible, setCursorVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isOnline } = useSSE();

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  // Listen for log events using global SSE connection
  useLogsEvents({
    onInit: (data) => {
      setLogs(data.logs || []);
    },
    onUpdate: (data) => {
      setLogs((prev) => {
        // Merge new logs, avoiding duplicates
        const newLogs = data.logs || [];
        const existingHashes = new Set(prev.map(log => `${log.timestamp}-${log.action}-${log.url}`));
        const uniqueNewLogs = newLogs.filter((log: LogLine) =>
          !existingHashes.has(`${log.timestamp}-${log.action}-${log.url}`)
        );
        return [...prev, ...uniqueNewLogs];
      });
    },
  });

  // Cursor blinking
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setCursorVisible(prev => !prev);
    }, 530);
    return () => clearInterval(cursorInterval);
  }, []);

  const getStatusColor = (status?: number) => {
    if (!status) return 'text-muted-foreground';
    if (status >= 200 && status < 300) return 'text-emerald-600 dark:text-emerald-400';
    if (status >= 300 && status < 400) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'SUCCESS': return 'text-emerald-600 dark:text-emerald-400';
      case 'ERROR': return 'text-red-600 dark:text-red-400';
      case 'WARNING': return 'text-yellow-600 dark:text-yellow-400';
      case 'INFO': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-muted-foreground';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="rounded-lg border border-border/30 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-terminal border-b border-border/20">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
        </div>
        <span className="text-[10px] font-mono text-muted-foreground ml-2">
          crawler.log
        </span>
        <span className="text-[10px] font-mono text-muted-foreground ml-auto">
          {logs.length} entries
        </span>
      </div>

      <div ref={containerRef} className="bg-terminal p-3 h-32 overflow-y-auto">
        <div className="space-y-1 font-mono text-[11px]">
          {logs.length === 0 ? (
            <div className="text-muted-foreground">暂无日志</div>
          ) : (
            logs.map((log, i) => (
              <div
                key={i}
                className="flex items-center gap-2"
              >
                <span className="text-muted-foreground">{'>'}</span>
                {log.status && (
                  <span className={`${getStatusColor(log.status)} font-medium`}>
                    [{log.status}]
                  </span>
                )}
                <span className={`${getLevelColor(log.level)} font-medium`}>
                  {log.action}
                </span>
                <span className="text-muted-foreground truncate flex-1" title={log.url}>
                  {log.url.length > 30 ? log.url.slice(0, 30) + '...' : log.url}
                </span>
                {log.duration && (
                  <span className="text-blue-600/70 dark:text-blue-400/70">{log.duration}</span>
                )}
                <span className="text-emerald-600/70 dark:text-emerald-400/70">{formatTime(log.timestamp)}</span>
              </div>
            ))
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{'>'}</span>
            <span className={cursorVisible ? 'opacity-100' : 'opacity-0'}>▌</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-1.5 bg-terminal/50 border-t border-border/20">
        <div className={`relative w-2 h-2 ${isOnline ? '' : 'opacity-30'}`}>
          <div className={`absolute inset-0 rounded-full bg-emerald-600 dark:bg-emerald-500 ${isOnline ? 'animate-ping opacity-75' : ''}`} />
          <div className="relative w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-500" />
        </div>
        <span className={`text-[10px] font-mono ${isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          状态: {isOnline ? '实时' : '离线'}
        </span>
      </div>
    </div>
  );
}
