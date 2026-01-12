/**
 * FeedLogger Tests
 *
 * Tests for the logging service for feed fetch operations.
 *
 * Run: bun test -- logger.test.ts
 */

import { describe, it, expect } from 'bun:test';
import { FeedLogger, LogLevel, FetchLogEntry } from './logger';

describe('FeedLogger', () => {
  describe('constructor', () => {
    it('should store feedId', () => {
      const logger = new FeedLogger('feed-123', 'urlhash123');
      expect((logger as any).feedId).toBe('feed-123');
    });

    it('should store urlHash', () => {
      const logger = new FeedLogger('feed-123', 'urlhash123');
      expect((logger as any).urlHash).toBe('urlhash123');
    });

    it('should store dataDir', () => {
      const logger = new FeedLogger('feed-123', 'urlhash123', '/some/path');
      expect((logger as any).dataDir).toBe('/some/path');
    });
  });

  describe('LogLevel enum', () => {
    it('should have correct values', () => {
      expect(LogLevel.INFO).toBe('INFO');
      expect(LogLevel.SUCCESS).toBe('SUCCESS');
      expect(LogLevel.WARNING).toBe('WARNING');
      expect(LogLevel.ERROR).toBe('ERROR');
    });
  });

  describe('FetchLogEntry interface', () => {
    it('should accept minimal entry', () => {
      const entry: FetchLogEntry = {
        timestamp: new Date().toISOString(),
        level: LogLevel.INFO,
        action: 'FETCH',
        url: 'https://example.com/feed',
      };
      expect(entry.level).toBe(LogLevel.INFO);
    });

    it('should accept entry with all fields', () => {
      const entry: FetchLogEntry = {
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

  describe('public API', () => {
    it('should expose info method', () => {
      const logger = new FeedLogger('feed-123', 'urlhash123');
      expect(typeof logger.info).toBe('function');
    });

    it('should expose success method', () => {
      const logger = new FeedLogger('feed-123', 'urlhash123');
      expect(typeof logger.success).toBe('function');
    });

    it('should expose warning method', () => {
      const logger = new FeedLogger('feed-123', 'urlhash123');
      expect(typeof logger.warning).toBe('function');
    });

    it('should expose error method', () => {
      const logger = new FeedLogger('feed-123', 'urlhash123');
      expect(typeof logger.error).toBe('function');
    });

    it('should expose getRecentLogs method', () => {
      const logger = new FeedLogger('feed-123', 'urlhash123');
      expect(typeof logger.getRecentLogs).toBe('function');
    });

    it('should expose clearLogs method', () => {
      const logger = new FeedLogger('feed-123', 'urlhash123');
      expect(typeof logger.clearLogs).toBe('function');
    });
  });
});
