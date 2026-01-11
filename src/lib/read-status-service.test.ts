/**
 * ReadStatusService Tests
 *
 * Tests the database layer that manages read status.
 * Note: These tests primarily verify the service structure since
 * the actual database operations require a Supabase connection.
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
    it('getReadHashes should be a function', () => {
      const service = new ReadStatusService('test-user-id');
      expect(typeof service.getReadHashes).toBe('function');
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
  });

  describe('instance properties', () => {
    it('should have userId property', () => {
      const service = new ReadStatusService('user-123');
      expect('userId' in (service as any)).toBe(true);
    });
  });
});
