/**
 * ReadStatusService Tests
 *
 * Tests the database layer that manages read status.
 *
 * Run: bun test -- read-status-service.test.ts
 */

import { describe, it, expect } from 'bun:test';
import { ReadStatusService } from './read-status-service';

describe('ReadStatusService', () => {
  describe('constructor', () => {
    it('should store userId', () => {
      const service = new ReadStatusService('user-123');
      expect((service as any).userId).toBe('user-123');
    });

    it('should handle empty userId', () => {
      const service = new ReadStatusService('');
      expect((service as any).userId).toBe('');
    });

    it('should handle UUID format userId', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const service = new ReadStatusService(uuid);
      expect((service as any).userId).toBe(uuid);
    });
  });

  describe('method signatures', () => {
    it('getReadArticleIds should be a function', () => {
      const service = new ReadStatusService('test-user-id');
      expect(typeof service.getReadArticleIds).toBe('function');
    });

    it('markAsRead should be a function', () => {
      const service = new ReadStatusService('test-user-id');
      expect(typeof service.markAsRead).toBe('function');
    });

    it('markAllAsRead should be a function', () => {
      const service = new ReadStatusService('test-user-id');
      expect(typeof service.markAllAsRead).toBe('function');
    });

    it('markAsUnread should be a function', () => {
      const service = new ReadStatusService('test-user-id');
      expect(typeof service.markAsUnread).toBe('function');
    });

    it('toggleBookmark should be a function', () => {
      const service = new ReadStatusService('test-user-id');
      expect(typeof service.toggleBookmark).toBe('function');
    });

    it('toggleReadLater should be a function', () => {
      const service = new ReadStatusService('test-user-id');
      expect(typeof service.toggleReadLater).toBe('function');
    });
  });

  describe('instance properties', () => {
    it('should have userId property', () => {
      const service = new ReadStatusService('user-123');
      expect('userId' in (service as any)).toBe(true);
    });
  });

  describe('backward compatibility methods', () => {
    it('getReadHashes should be a function', () => {
      const service = new ReadStatusService('test-user-id');
      expect(typeof service.getReadHashes).toBe('function');
    });

    it('markAsReadByHash should be a function', () => {
      const service = new ReadStatusService('test-user-id');
      expect(typeof service.markAsReadByHash).toBe('function');
    });

    it('markAsUnreadByHash should be a function', () => {
      const service = new ReadStatusService('test-user-id');
      expect(typeof service.markAsUnreadByHash).toBe('function');
    });
  });
});
