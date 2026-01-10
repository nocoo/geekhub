/**
 * ReadStatusService Tests
 *
 * Tests the database layer that manages read status.
 *
 * Run: npm test -- read-status-service.test.ts
 */

import { ReadStatusService } from './read-status-service';

// Mock Supabase client
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}));

// Mock cookies
jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

describe('ReadStatusService', () => {
  let service: ReadStatusService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock createClient method
    const mockEq = jest.fn().mockResolvedValue({ error: null, data: null });
    const mockClient = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [
                { article_hash: 'abc123' },
                { article_hash: 'def456' },
              ],
              error: null,
            }),
          }),
        }),
        insert: jest.fn().mockResolvedValue({
          error: null,
          data: null,
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: mockEq,
            }),
          }),
        }),
      }),
    };

    service = new ReadStatusService('test-user-id');
    (service as any).createClient = jest.fn().mockResolvedValue(mockClient);
  });

  describe('getReadHashes', () => {
    it('should return set of read article hashes', async () => {
      const hashes = await service.getReadHashes('feed-123');

      expect(hashes).toBeInstanceOf(Set);
      expect(hashes.has('abc123')).toBe(true);
      expect(hashes.has('def456')).toBe(true);
      expect(hashes.has('nonexistent')).toBe(false);
    });

    it('should return empty set on database error', async () => {
      const mockClient = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
              }),
            })),
          })),
        })),
      };

      (service as any).createClient = jest.fn().mockResolvedValue(mockClient);

      const hashes = await service.getReadHashes('feed-123');

      expect(hashes).toBeInstanceOf(Set);
      expect(hashes.size).toBe(0);
    });

    it('should return empty set when no data returned', async () => {
      const mockClient = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          })),
        })),
      };

      (service as any).createClient = jest.fn().mockResolvedValue(mockClient);

      const hashes = await service.getReadHashes('feed-123');

      expect(hashes).toBeInstanceOf(Set);
      expect(hashes.size).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('should mark article as read successfully', async () => {
      const result = await service.markAsRead('feed-123', 'abc123');

      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      const mockClient = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockResolvedValue({
            error: { message: 'Insert failed' },
            data: null,
          }),
        }),
      };

      (service as any).createClient = jest.fn().mockResolvedValue(mockClient);

      const result = await service.markAsRead('feed-123', 'abc123');

      expect(result).toBe(false);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark multiple articles as read', async () => {
      const hashes = ['abc123', 'def456', 'ghi789'];
      const count = await service.markAllAsRead('feed-123', hashes);

      expect(count).toBe(3);
    });

    it('should return 0 on error', async () => {
      const mockClient = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockResolvedValue({
            error: { message: 'Batch insert failed' },
            data: null,
          }),
        }),
      };

      (service as any).createClient = jest.fn().mockResolvedValue(mockClient);

      const count = await service.markAllAsRead('feed-123', ['abc123', 'def456']);

      expect(count).toBe(0);
    });
  });

  describe('markAsUnread', () => {
    it('should mark article as unread successfully', async () => {
      const result = await service.markAsUnread('feed-123', 'abc123');

      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      const mockEqError = jest.fn().mockResolvedValue({
        error: { message: 'Delete failed' },
        data: null,
      });
      const mockClient = {
        from: jest.fn(() => ({
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: mockEqError,
              }),
            }),
          }),
        })),
      };

      (service as any).createClient = jest.fn().mockResolvedValue(mockClient);

      const result = await service.markAsUnread('feed-123', 'abc123');

      expect(result).toBe(false);
    });
  });
});
