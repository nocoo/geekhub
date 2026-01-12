/**
 * ReadStatusService Tests
 *
 * Tests for the database layer that manages read status.
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

  describe('public API', () => {
    it('should expose getReadArticleIds method', () => {
      const service = new ReadStatusService('test-user-id');
      expect(typeof service.getReadArticleIds).toBe('function');
    });

    it('should expose markAsRead method', () => {
      const service = new ReadStatusService('test-user-id');
      expect(typeof service.markAsRead).toBe('function');
    });

    it('should expose markAllAsRead method', () => {
      const service = new ReadStatusService('test-user-id');
      expect(typeof service.markAllAsRead).toBe('function');
    });

    it('should expose markAsUnread method', () => {
      const service = new ReadStatusService('test-user-id');
      expect(typeof service.markAsUnread).toBe('function');
    });

    it('should expose toggleBookmark method', () => {
      const service = new ReadStatusService('test-user-id');
      expect(typeof service.toggleBookmark).toBe('function');
    });

    it('should expose toggleReadLater method', () => {
      const service = new ReadStatusService('test-user-id');
      expect(typeof service.toggleReadLater).toBe('function');
    });

    it('should expose getReadHashes method', () => {
      const service = new ReadStatusService('test-user-id');
      expect(typeof service.getReadHashes).toBe('function');
    });

    it('should expose markAsReadByHash method', () => {
      const service = new ReadStatusService('test-user-id');
      expect(typeof service.markAsReadByHash).toBe('function');
    });

    it('should expose markAsUnreadByHash method', () => {
      const service = new ReadStatusService('test-user-id');
      expect(typeof service.markAsUnreadByHash).toBe('function');
    });
  });
});
