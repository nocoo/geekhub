import { promises as fs } from 'fs';
import path from 'path';

export enum LogLevel {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

export interface FetchLogEntry {
  timestamp: string;
  level: LogLevel;
  status?: number;
  action: string;
  url: string;
  duration?: string;
  message?: string;
}

export class FeedLogger {
  private logFilePath: string;
  private feedDir: string;

  constructor(urlHash: string, private dataDir: string = path.join(process.cwd(), 'data')) {
    this.feedDir = path.join(this.dataDir, 'feeds', urlHash);
    this.logFilePath = path.join(this.feedDir, 'fetch.log');
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.feedDir, { recursive: true });
  }

  private formatLogEntry(entry: FetchLogEntry): string {
    const status = entry.status ? `[${entry.status}]` : '';
    const duration = entry.duration ? ` (${entry.duration})` : '';
    const message = entry.message ? ` - ${entry.message}` : '';
    return `[${entry.timestamp}] ${entry.level} ${status} ${entry.action} ${entry.url}${duration}${message}`;
  }

  async info(action: string, url: string, message?: string): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      action,
      url,
      message,
    });
  }

  async success(status: number, action: string, url: string, duration: string, message?: string): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      level: LogLevel.SUCCESS,
      status,
      action,
      url,
      duration,
      message,
    });
  }

  async warning(action: string, url: string, message: string): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      level: LogLevel.WARNING,
      action,
      url,
      message,
    });
  }

  async error(action: string, url: string, error: Error | string): Promise<void> {
    const message = typeof error === 'string' ? error : error.message;
    await this.log({
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      action,
      url,
      message,
    });
  }

  private async log(entry: FetchLogEntry): Promise<void> {
    await this.ensureDir();
    const line = this.formatLogEntry(entry) + '\n';
    await fs.appendFile(this.logFilePath, line, 'utf-8');
  }

  async getRecentLogs(lines: number = 100): Promise<string[]> {
    try {
      await this.ensureDir();
      const content = await fs.readFile(this.logFilePath, 'utf-8');
      const allLines = content.split('\n').filter(line => line.trim());
      return allLines.slice(-lines);
    } catch {
      return [];
    }
  }

  async clearLogs(): Promise<void> {
    try {
      await fs.writeFile(this.logFilePath, '', 'utf-8');
    } catch {
      // Ignore if file doesn't exist
    }
  }
}
