import { describe, test, expect, mock, beforeEach, spyOn } from 'bun:test';
import { FeedLogger, LogLevel, type FetchLogEntry } from './logger';

const mockInsert = mock(() => Promise.resolve({ error: null }));
const mockSelect = mock(() => ({
  eq: mock(() => ({
    order: mock(() => ({
      limit: mock(() => Promise.resolve({ 
        data: [
          { fetched_at: '2026-02-01T00:00:00Z', level: 'INFO', action: 'FETCH', url: 'https://example.com' },
          { fetched_at: '2026-02-02T00:00:00Z', level: 'SUCCESS', action: 'PARSE', url: 'https://example.com' },
        ], 
        error: null 
      })),
    })),
  })),
}));
const mockFrom = mock(() => ({
  insert: mockInsert,
  select: mockSelect,
}));

mock.module('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

describe('FeedLogger', () => {
  beforeEach(() => {
    mockInsert.mockClear();
    mockFrom.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  });

  describe('constructor', () => {
    test('stores feedId', () => {
      const logger = new FeedLogger('feed-123', 'urlhash123');
      expect((logger as any).feedId).toBe('feed-123');
    });

    test('stores urlHash', () => {
      const logger = new FeedLogger('feed-123', 'urlhash123');
      expect((logger as any).urlHash).toBe('urlhash123');
    });
  });

  describe('LogLevel enum', () => {
    test('has correct values', () => {
      expect(LogLevel.INFO).toBe('INFO');
      expect(LogLevel.SUCCESS).toBe('SUCCESS');
      expect(LogLevel.WARNING).toBe('WARNING');
      expect(LogLevel.ERROR).toBe('ERROR');
    });
  });

  describe('FetchLogEntry interface', () => {
    test('accepts minimal entry', () => {
      const entry: FetchLogEntry = {
        timestamp: new Date().toISOString(),
        level: LogLevel.INFO,
        action: 'FETCH',
        url: 'https://example.com/feed',
      };
      expect(entry.level).toBe(LogLevel.INFO);
    });

    test('accepts entry with all fields', () => {
      const entry: FetchLogEntry = {
        id: 'entry-1',
        timestamp: new Date().toISOString(),
        level: LogLevel.SUCCESS,
        status: 200,
        action: 'PARSE',
        url: 'https://example.com/feed',
        duration_ms: 150,
        message: 'Success',
        feed_id: 'feed-123',
      };
      expect(entry.status).toBe(200);
      expect(entry.duration_ms).toBe(150);
    });
  });

  describe('info()', () => {
    test('saves INFO level log to database', async () => {
      const logger = new FeedLogger('feed-123', 'urlhash123');
      
      await logger.info('FETCH', 'https://example.com/feed', 'Starting fetch');
      
      expect(mockFrom).toHaveBeenCalledWith('fetch_logs');
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        feed_id: 'feed-123',
        level: LogLevel.INFO,
        action: 'FETCH',
        url: 'https://example.com/feed',
        message: 'Starting fetch',
      }));
    });

    test('saves log without message when not provided', async () => {
      const logger = new FeedLogger('feed-123', 'urlhash123');
      
      await logger.info('FETCH', 'https://example.com/feed');
      
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        message: undefined,
      }));
    });
  });

  describe('success()', () => {
    test('saves SUCCESS level log with status and duration', async () => {
      const logger = new FeedLogger('feed-123', 'urlhash123');
      
      await logger.success(200, 'PARSE', 'https://example.com/feed', '150', 'Parsed 10 items');
      
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.SUCCESS,
        status: 200,
        action: 'PARSE',
        duration_ms: 150,
        message: 'Parsed 10 items',
      }));
    });

    test('handles non-numeric duration string', async () => {
      const logger = new FeedLogger('feed-123', 'urlhash123');
      
      await logger.success(200, 'PARSE', 'https://example.com/feed', 'invalid');
      
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        duration_ms: 0,
      }));
    });
  });

  describe('warning()', () => {
    test('saves WARNING level log', async () => {
      const logger = new FeedLogger('feed-123', 'urlhash123');
      
      await logger.warning('FETCH', 'https://example.com/feed', 'Slow response');
      
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.WARNING,
        action: 'FETCH',
        message: 'Slow response',
      }));
    });
  });

  describe('error()', () => {
    test('saves ERROR level log with Error object', async () => {
      const logger = new FeedLogger('feed-123', 'urlhash123');
      
      await logger.error('FETCH', 'https://example.com/feed', new Error('Network timeout'));
      
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.ERROR,
        action: 'FETCH',
        message: 'Network timeout',
      }));
    });

    test('saves ERROR level log with string message', async () => {
      const logger = new FeedLogger('feed-123', 'urlhash123');
      
      await logger.error('PARSE', 'https://example.com/feed', 'Invalid XML');
      
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        level: LogLevel.ERROR,
        message: 'Invalid XML',
      }));
    });
  });

  describe('getRecentLogs()', () => {
    test('returns logs from database', async () => {
      const logger = new FeedLogger('feed-123', 'urlhash123');
      
      const logs = await logger.getRecentLogs();
      
      expect(logs).toHaveLength(2);
      expect(logs.some(l => l.level === 'INFO')).toBe(true);
      expect(logs.some(l => l.level === 'SUCCESS')).toBe(true);
    });

    test('returns empty array on error', async () => {
      mockSelect.mockImplementationOnce(() => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: null, error: new Error('DB error') }),
          }),
        }),
      }));
      
      const logger = new FeedLogger('feed-123', 'urlhash123');
      
      const logs = await logger.getRecentLogs();
      
      expect(logs).toEqual([]);
    });
  });

  describe('clearLogs()', () => {
    test('logs warning about unsupported operation', async () => {
      const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
      const logger = new FeedLogger('feed-123', 'urlhash123');
      
      await logger.clearLogs();
      
      expect(warnSpy).toHaveBeenCalledWith('clearLogs() is not supported in database mode');
      warnSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    test('handles database insert error gracefully', async () => {
      const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
      mockInsert.mockImplementationOnce(() => Promise.reject(new Error('DB error')));
      
      const logger = new FeedLogger('feed-123', 'urlhash123');
      
      await logger.info('FETCH', 'https://example.com/feed');
      
      expect(errorSpy).toHaveBeenCalledWith('Failed to save log to database:', expect.any(Error));
      errorSpy.mockRestore();
    });
  });
});
