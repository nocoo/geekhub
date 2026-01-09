import { useEffect, useState } from 'react';
import { crawlerLogs } from '@/lib/mockData';

interface LogLine {
  status: number;
  action: string;
  url: string;
  time: string;
}

export function CrawlerTerminal() {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    // Simulate logs appearing one by one
    let index = 0;
    const interval = setInterval(() => {
      if (index < crawlerLogs.length) {
        const log = crawlerLogs[index];
        if (log) {
          setLogs(prev => [...prev, log]);
        }
        index++;
      } else {
        // Reset and start again after a pause
        setLogs([]);
        index = 0;
      }
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setCursorVisible(prev => !prev);
    }, 530);
    return () => clearInterval(cursorInterval);
  }, []);

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-emerald-400';
    if (status >= 300 && status < 400) return 'text-yellow-400';
    return 'text-red-400';
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
      </div>
      
      <div className="bg-terminal p-3 h-32 overflow-hidden">
        <div className="space-y-1 font-mono text-[11px]">
          {logs.map((log, i) => (
            <div 
              key={i} 
              className="flex items-center gap-2 animate-slide-in"
            >
              <span className="text-muted-foreground">{'>'}</span>
              <span className={`${getStatusColor(log.status)} font-medium`}>
                [{log.status}]
              </span>
              <span className="text-primary/80">{log.action}</span>
              <span className="text-muted-foreground truncate flex-1">
                {log.url}
              </span>
              <span className="text-emerald-400/70">{log.time}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{'>'}</span>
            <span className={cursorVisible ? 'opacity-100' : 'opacity-0'}>▌</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-1.5 bg-terminal/50 border-t border-border/20">
        <div className="relative w-2 h-2">
          <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
          <div className="relative w-2 h-2 rounded-full bg-emerald-500" />
        </div>
        <span className="text-[10px] font-mono text-emerald-400">
          Status: Online
        </span>
        <span className="text-[10px] font-mono text-muted-foreground ml-auto">
          Last sync: 2m ago
        </span>
      </div>
    </div>
  );
}
